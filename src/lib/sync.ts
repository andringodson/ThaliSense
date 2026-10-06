/*
 * Optional cloud backup and sync for signed-in users.
 *
 * The app stays local-first: localStorage is the source the UI reads, and
 * sync copies it to Firestore so the same account can be used on another
 * device. Layout, readable only by the owner (firestore.rules):
 *
 *   users/{uid}                  { profile, profileAt, measures, demo, updatedAt }
 *   users/{uid}/months/{yyyy-mm} { entries, deleted, updatedAt }
 *
 * Merging is deterministic so two devices converge: meal entries are unioned
 * by id with the newest edit winning, deletions are kept as tombstones so a
 * meal removed on one phone doesn't come back from another, and the profile
 * with the newer timestamp wins. Photos are never part of any of this.
 */
import type { Measure, Profile } from './health'
import type { LogEntry } from './nutrition'
import type { Firebase } from './firebase'

export interface Meta {
  /** When the profile was last changed on this device (ms). */
  profileAt: number
  /** True while the data on this device is the built-in demo week. */
  demo: boolean
  /** Deleted meal-entry ids, mapped to their month, so deletions sync. */
  deleted: Record<string, string>
  /** The account this device's data belongs to, once someone has signed in. */
  owner?: string
}

export const EMPTY_META: Meta = { profileAt: 0, demo: false, deleted: {} }

export interface LocalData {
  profile: Profile | null
  logs: LogEntry[]
  measures: Measure[]
  meta: Meta
}

export interface CloudUser {
  profile: Profile | null
  profileAt: number
  measures: Measure[]
  demo: boolean
  updatedAt: number
}

export interface CloudMonth {
  entries: LogEntry[]
  deleted: string[]
  updatedAt: number
}

export const monthOf = (date: string) => date.slice(0, 7)

const newer = <T extends { updatedAt?: number }>(a: T, b: T) => ((b.updatedAt ?? 0) > (a.updatedAt ?? 0) ? b : a)

/**
 * Combine this device's data with `uid`'s cloud copy. Guest data (never signed
 * in) is adopted by the first account; data that belongs to a different
 * account, or the demo week, never flows into this one.
 */
export function merge(local: LocalData, user: CloudUser | null, months: Record<string, CloudMonth>, uid: string): LocalData {
  const cloudEntries = Object.values(months).flatMap((m) => m.entries)
  const cloudDeleted: Record<string, string> = {}
  for (const [month, m] of Object.entries(months)) for (const id of m.deleted) cloudDeleted[id] = month

  const cloudOnly = (): LocalData => ({
    profile: user?.profile ?? null,
    logs: cloudEntries.filter((e) => !(e.id in cloudDeleted)),
    measures: user?.measures ?? [],
    meta: { profileAt: user?.profileAt ?? 0, demo: user?.demo ?? false, deleted: cloudDeleted, owner: uid },
  })
  // Someone else's data on a shared device: show only this account's.
  if (local.meta.owner && local.meta.owner !== uid) return cloudOnly()
  // The demo week never overwrites a real account.
  if (local.meta.demo && user?.profile) return cloudOnly()

  const deleted = { ...cloudDeleted, ...local.meta.deleted }
  const byId = new Map<string, LogEntry>()
  for (const e of [...cloudEntries, ...local.logs]) {
    const prev = byId.get(e.id)
    byId.set(e.id, prev ? newer(prev, e) : e)
  }
  const logs = [...byId.values()].filter((e) => !(e.id in deleted)).sort((a, b) => a.date.localeCompare(b.date))

  const byDate = new Map<string, Measure>()
  for (const m of [...(user?.measures ?? []), ...local.measures]) {
    const prev = byDate.get(m.date)
    byDate.set(m.date, prev && (prev.at ?? 0) > (m.at ?? 0) ? prev : m)
  }
  const measures = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))

  const cloudWins = !!user?.profile && (user.profileAt > local.meta.profileAt || !local.profile)
  return {
    profile: cloudWins ? user!.profile : local.profile,
    logs,
    measures,
    meta: {
      profileAt: cloudWins ? user!.profileAt : local.meta.profileAt,
      demo: cloudWins ? user!.demo : local.meta.demo,
      deleted,
      owner: uid,
    },
  }
}

/** Group local data into the cloud's month documents. */
export function toMonths(data: LocalData): Record<string, Omit<CloudMonth, 'updatedAt'>> {
  const out: Record<string, Omit<CloudMonth, 'updatedAt'>> = {}
  const slot = (m: string) => (out[m] ??= { entries: [], deleted: [] })
  for (const e of data.logs) slot(monthOf(e.date)).entries.push(e)
  for (const [id, m] of Object.entries(data.meta.deleted)) slot(m).deleted.push(id)
  for (const v of Object.values(out)) {
    v.entries.sort((a, b) => a.id.localeCompare(b.id))
    v.deleted.sort()
  }
  return out
}

export function toUser(data: LocalData): Omit<CloudUser, 'updatedAt'> {
  return { profile: data.profile, profileAt: data.meta.profileAt, measures: data.measures, demo: data.meta.demo }
}

/** Order-independent fingerprint, to push only what changed. */
export const keyOf = (v: unknown) => JSON.stringify(v)

/** Firestore rejects `undefined` values; drop them. */
const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v))

export async function pull(fb: Firebase, uid: string): Promise<{ user: CloudUser | null; months: Record<string, CloudMonth> }> {
  const { store, db } = fb
  const [userSnap, monthSnap] = await Promise.all([
    store.getDoc(store.doc(db, 'users', uid)),
    store.getDocs(store.collection(db, 'users', uid, 'months')),
  ])
  const months: Record<string, CloudMonth> = {}
  monthSnap.forEach((d) => {
    months[d.id] = d.data() as CloudMonth
  })
  return { user: userSnap.exists() ? (userSnap.data() as CloudUser) : null, months }
}

/** Write the user document and the given months in one atomic batch. */
export async function push(fb: Firebase, uid: string, data: LocalData, months: string[], withUser: boolean) {
  const { store, db } = fb
  const all = toMonths(data)
  const batch = store.writeBatch(db)
  const now = Date.now()
  if (withUser) batch.set(store.doc(db, 'users', uid), clean({ ...toUser(data), updatedAt: now }))
  for (const m of months) {
    const v = all[m] ?? { entries: [], deleted: [] }
    batch.set(store.doc(db, 'users', uid, 'months', m), clean({ ...v, updatedAt: now }))
  }
  await batch.commit()
}

/** Delete everything this user has in the cloud. */
export async function wipe(fb: Firebase, uid: string) {
  const { store, db } = fb
  const months = await store.getDocs(store.collection(db, 'users', uid, 'months'))
  const batch = store.writeBatch(db)
  months.forEach((d) => batch.delete(d.ref))
  batch.delete(store.doc(db, 'users', uid))
  await batch.commit()
}
