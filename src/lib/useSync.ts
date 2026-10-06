import { useCallback, useEffect, useRef, useState } from 'react'
import type { Firebase } from './firebase'
import { keyOf, merge, pull, push, toMonths, toUser, type LocalData } from './sync'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

const PUSH_DELAY = 1200
const REFRESH_AFTER = 30_000

/**
 * Keeps local data and the signed-in user's cloud copy in step.
 * Never blocks the UI: everything works from local data while it syncs.
 */
export function useCloudSync(fb: Firebase | null, uid: string | null, data: LocalData, apply: (d: LocalData) => void) {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [lastSynced, setLastSynced] = useState<number | null>(null)
  const pushed = useRef<{ months: Map<string, string>; user: string } | null>(null)
  const latest = useRef(data)
  latest.current = data
  const lastPull = useRef(0)
  const busy = useRef(false)

  const fail = useCallback(() => setStatus(navigator.onLine ? 'error' : 'offline'), [])

  /** Push whatever differs from what the cloud last saw. */
  const flush = useCallback(async () => {
    if (!fb || !uid || !pushed.current || busy.current) return
    const d = latest.current
    const months = toMonths(d)
    const keys = new Map(Object.entries(months).map(([m, v]) => [m, keyOf(v)]))
    const changed = [...keys].filter(([m, k]) => pushed.current!.months.get(m) !== k).map(([m]) => m)
    const userKey = keyOf(toUser(d))
    const userChanged = userKey !== pushed.current.user
    if (!changed.length && !userChanged) return
    busy.current = true
    setStatus('syncing')
    try {
      await push(fb, uid, d, changed, userChanged)
      for (const m of changed) pushed.current.months.set(m, keys.get(m)!)
      pushed.current.user = userKey
      setStatus('synced')
      setLastSynced(Date.now())
    } catch {
      fail()
    } finally {
      busy.current = false
    }
  }, [fb, uid, fail])

  /** Pull the cloud copy, merge it in, then push anything only this device had. */
  const syncNow = useCallback(async () => {
    if (!fb || !uid || busy.current) return
    busy.current = true
    setStatus('syncing')
    try {
      const cloud = await pull(fb, uid)
      lastPull.current = Date.now()
      const merged = merge(latest.current, cloud.user, cloud.months, uid)
      // What the cloud holds now, so flush() sends only the differences.
      pushed.current = {
        months: new Map(Object.entries(cloud.months).map(([m, v]) => [m, keyOf({ entries: v.entries, deleted: v.deleted })])),
        user: cloud.user ? keyOf({ profile: cloud.user.profile, profileAt: cloud.user.profileAt, measures: cloud.user.measures, demo: cloud.user.demo }) : '',
      }
      if (keyOf(merged) !== keyOf(latest.current)) apply(merged)
      latest.current = merged
      busy.current = false
      await flush()
      setStatus('synced')
      setLastSynced(Date.now())
    } catch {
      busy.current = false
      fail()
    }
  }, [fb, uid, apply, flush, fail])

  // Sign-in (or a different account): full sync. Sign-out: stop.
  useEffect(() => {
    pushed.current = null
    if (fb && uid) void syncNow()
    else setStatus('idle')
    // syncNow changes identity with fb/uid only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fb, uid])

  // Local edits: push shortly after the last change.
  useEffect(() => {
    if (!fb || !uid || !pushed.current) return
    const t = window.setTimeout(() => void flush(), PUSH_DELAY)
    return () => window.clearTimeout(t)
  }, [data, fb, uid, flush])

  // Coming back to the tab, or back online: pick up changes from other devices.
  useEffect(() => {
    if (!fb || !uid) return
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastPull.current > REFRESH_AFTER) void syncNow()
    }
    const onOnline = () => void syncNow()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [fb, uid, syncNow])

  return { status, lastSynced, syncNow }
}
