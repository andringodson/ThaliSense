/*
 * Firebase, loaded only when it is needed.
 *
 * Sign-in is optional, so the Firebase SDK is never part of the first page
 * load: it is fetched when someone opens the sign-in sheet, or in the
 * background when a returning user has a saved session. Data goes through
 * Firestore Lite (plain HTTPS, no realtime channel), which is much smaller
 * than full Firestore and is all a pull/push sync needs.
 *
 * Configuration comes from VITE_FIREBASE_* environment variables (see
 * docs/auth-setup.md). Without them the account UI is hidden and the app
 * works exactly as before, fully on-device.
 */
import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore/lite'

const env = import.meta.env

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const authConfigured = !!(config.apiKey && config.projectId && config.authDomain)
const useEmulator = env.VITE_FIREBASE_EMULATOR === '1'

export type ProviderId = 'google' | 'facebook' | 'apple'

/** Social providers to offer. Apple stays off until a Services ID is set up (it needs a paid Apple developer account). */
export const providers: ProviderId[] = ((env.VITE_AUTH_PROVIDERS as string | undefined) ?? 'google,facebook')
  .split(',')
  .map((p) => p.trim())
  .filter((p): p is ProviderId => p === 'google' || p === 'facebook' || p === 'apple')

export interface Firebase {
  app: FirebaseApp
  auth: Auth
  db: Firestore
  authMod: typeof import('firebase/auth')
  store: typeof import('firebase/firestore/lite')
}

let loading: Promise<Firebase> | null = null

export function loadFirebase(): Promise<Firebase> {
  if (!authConfigured) return Promise.reject(new Error('Sign-in is not configured'))
  loading ??= (async () => {
    const [{ initializeApp }, authMod, store] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore/lite'),
    ])
    const app = initializeApp(config)
    const auth = authMod.initializeAuth(app, {
      persistence: [authMod.indexedDBLocalPersistence, authMod.browserLocalPersistence],
      popupRedirectResolver: authMod.browserPopupRedirectResolver,
    })
    const db = store.getFirestore(app)
    if (useEmulator) {
      authMod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
      store.connectFirestoreEmulator(db, '127.0.0.1', 8080)
    }
    return { app, auth, db, authMod, store }
  })()
  loading.catch(() => {
    loading = null
  })
  return loading
}
