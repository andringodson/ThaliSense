// Security rules, tested against the Firestore emulator (npm run test:rules).
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-thalisense',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})
afterAll(() => env.cleanup())
beforeEach(() => env.clearFirestore())

const user = { profile: null, profileAt: 0, measures: [], demo: false, updatedAt: 1 }
const month = { entries: [], deleted: [], updatedAt: 1 }

describe('firestore.rules', () => {
  it('lets a user read and write only their own data', async () => {
    const asha = env.authenticatedContext('asha').firestore()
    await assertSucceeds(setDoc(doc(asha, 'users/asha'), user))
    await assertSucceeds(setDoc(doc(asha, 'users/asha/months/2026-10'), month))
    await assertSucceeds(getDoc(doc(asha, 'users/asha/months/2026-10')))
    await assertSucceeds(deleteDoc(doc(asha, 'users/asha/months/2026-10')))
  })

  it('keeps other users and signed-out visitors out', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/asha'), user)
      await setDoc(doc(ctx.firestore(), 'users/asha/months/2026-10'), month)
    })
    const ravi = env.authenticatedContext('ravi').firestore()
    const anon = env.unauthenticatedContext().firestore()
    for (const db of [ravi, anon]) {
      await assertFails(getDoc(doc(db, 'users/asha')))
      await assertFails(getDoc(doc(db, 'users/asha/months/2026-10')))
      await assertFails(setDoc(doc(db, 'users/asha'), user))
      await assertFails(deleteDoc(doc(db, 'users/asha/months/2026-10')))
    }
  })

  it('rejects malformed documents', async () => {
    const asha = env.authenticatedContext('asha').firestore()
    await assertFails(setDoc(doc(asha, 'users/asha'), { ...user, isAdmin: true }))
    await assertFails(setDoc(doc(asha, 'users/asha/months/october'), month))
    await assertFails(setDoc(doc(asha, 'users/asha/months/2026-10'), { ...month, entries: 'nope' }))
    await assertFails(setDoc(doc(asha, 'somewhere/else'), { a: 1 }))
  })
})
