import { describe, expect, it } from 'vitest'
import { DEFAULT_PROFILE } from './health'
import type { LogEntry } from './nutrition'
import { EMPTY_META, keyOf, merge, toMonths, type CloudMonth, type CloudUser, type LocalData } from './sync'

const entry = (id: string, date: string, qty = 1, updatedAt = 1): LogEntry => ({ id, date, meal: 'lunch', foodId: 'roti', qty, source: 'text', updatedAt })
const local = (over: Partial<LocalData> = {}): LocalData => ({ profile: DEFAULT_PROFILE, logs: [], measures: [], meta: { ...EMPTY_META }, ...over })
const cloudUser = (over: Partial<CloudUser> = {}): CloudUser => ({ profile: { ...DEFAULT_PROFILE, name: 'Cloud' }, profileAt: 10, measures: [], demo: false, updatedAt: 10, ...over })
const month = (entries: LogEntry[], deleted: string[] = []): CloudMonth => ({ entries, deleted, updatedAt: 1 })

describe('cloud sync merge', () => {
  it('unions meals from both devices and keeps the newest edit', () => {
    const m = merge(local({ logs: [entry('a', '2026-10-01', 2, 5), entry('b', '2026-10-02')] }), cloudUser(), { '2026-10': month([entry('a', '2026-10-01', 3, 9), entry('c', '2026-10-03')]) }, 'u1')
    expect(m.logs.map((e) => [e.id, e.qty])).toEqual([['a', 3], ['b', 1], ['c', 1]])
  })

  it('does not bring back a meal deleted on either device', () => {
    const onPhone = merge(local({ logs: [entry('a', '2026-10-01')] }), cloudUser(), { '2026-10': month([], ['a']) }, 'u1')
    expect(onPhone.logs).toEqual([])
    const onLaptop = merge(local({ meta: { ...EMPTY_META, deleted: { a: '2026-10' } } }), cloudUser(), { '2026-10': month([entry('a', '2026-10-01')]) }, 'u1')
    expect(onLaptop.logs).toEqual([])
    expect(toMonths(onLaptop)['2026-10'].deleted).toEqual(['a'])
  })

  it('keeps the newer profile', () => {
    expect(merge(local({ meta: { ...EMPTY_META, profileAt: 5 } }), cloudUser({ profileAt: 10 }), {}, 'u1').profile?.name).toBe('Cloud')
    expect(merge(local({ meta: { ...EMPTY_META, profileAt: 20 } }), cloudUser({ profileAt: 10 }), {}, 'u1').profile?.name).toBe(DEFAULT_PROFILE.name)
  })

  it('adopts guest data on first sign-in and marks the owner', () => {
    const m = merge(local({ logs: [entry('a', '2026-10-01')] }), null, {}, 'u1')
    expect(m.logs).toHaveLength(1)
    expect(m.meta.owner).toBe('u1')
  })

  it('never mixes the demo week or another account into this account', () => {
    const demo = merge(local({ logs: [entry('d', '2026-10-01')], meta: { ...EMPTY_META, demo: true } }), cloudUser(), { '2026-10': month([entry('c', '2026-10-02')]) }, 'u1')
    expect(demo.logs.map((e) => e.id)).toEqual(['c'])
    expect(demo.profile?.name).toBe('Cloud')
    const shared = merge(local({ logs: [entry('x', '2026-10-01')], meta: { ...EMPTY_META, owner: 'someone-else' } }), null, {}, 'u1')
    expect(shared.logs).toEqual([])
    expect(shared.profile).toBeNull()
  })

  it('is stable: merging the result again changes nothing', () => {
    const once = merge(local({ logs: [entry('a', '2026-10-01'), entry('b', '2026-09-30')] }), cloudUser(), { '2026-10': month([entry('c', '2026-10-03')]) }, 'u1')
    const months = Object.fromEntries(Object.entries(toMonths(once)).map(([k, v]) => [k, { ...v, updatedAt: 2 }]))
    const twice = merge(once, { ...cloudUser(), profile: once.profile, profileAt: once.meta.profileAt }, months, 'u1')
    expect(keyOf(twice.logs)).toBe(keyOf(once.logs))
  })
})
