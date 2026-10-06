import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { authConfigured, loadFirebase, type Firebase, type ProviderId } from './firebase'

export interface Account {
  uid: string
  name: string
  email: string | null
  photo: string | null
  /** 'google.com', 'facebook.com', 'apple.com' or 'password'. */
  provider: string
}

/** off: not configured · checking: restoring a saved session · signed-out · signed-in */
export type AuthStatus = 'off' | 'checking' | 'signed-out' | 'signed-in'

interface AuthApi {
  status: AuthStatus
  account: Account | null
  firebase: Firebase | null
  /** Start loading the SDK early, e.g. when the sign-in sheet opens. */
  prepare: () => void
  signInWith: (p: ProviderId) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
  signOut: () => Promise<void>
  deleteAccount: (beforeDelete?: (fb: Firebase, uid: string) => Promise<void>) => Promise<void>
}

const SESSION = 'ts.session'
const REDIRECT = 'ts.redirect'

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k)
      else localStorage.setItem(k, v)
    } catch {
      // Storage unavailable: the session simply isn't remembered.
    }
  },
}

function toAccount(u: User): Account {
  return {
    uid: u.uid,
    name: u.displayName || u.email?.split('@')[0] || 'You',
    email: u.email,
    photo: u.photoURL,
    provider: u.providerData[0]?.providerId ?? 'password',
  }
}

/** Plain-language messages for the errors people actually hit. */
export function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  const map: Record<string, string> = {
    'auth/invalid-credential': 'That email and password don’t match. Try again or reset your password.',
    'auth/wrong-password': 'That email and password don’t match. Try again or reset your password.',
    'auth/user-not-found': 'No account uses that email yet. Create one instead?',
    'auth/email-already-in-use': 'An account already uses that email. Sign in instead.',
    'auth/invalid-email': 'That doesn’t look like an email address.',
    'auth/weak-password': 'Use at least 8 characters for your password.',
    'auth/missing-password': 'Enter your password.',
    'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
    'auth/network-request-failed': 'No connection. Check your internet and try again.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/cancelled-popup-request': 'Sign-in was cancelled.',
    'auth/account-exists-with-different-credential':
      'You already have an account with this email using a different sign-in method. Use that one.',
    'auth/requires-recent-login': 'For your security, sign in again, then delete your account.',
    'auth/operation-not-allowed': 'This sign-in method isn’t switched on yet.',
    'auth/unauthorized-domain': 'This website isn’t authorised for sign-in yet.',
  }
  return map[code] ?? 'Something went wrong. Please try again.'
}

const Ctx = createContext<AuthApi | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() =>
    !authConfigured ? 'off' : store.get(SESSION) || store.get(REDIRECT) ? 'checking' : 'signed-out',
  )
  const [account, setAccount] = useState<Account | null>(null)
  const [firebase, setFirebase] = useState<Firebase | null>(null)
  const subscribed = useRef(false)

  const connect = useCallback(async () => {
    const fb = await loadFirebase()
    setFirebase(fb)
    if (!subscribed.current) {
      subscribed.current = true
      fb.authMod.onAuthStateChanged(fb.auth, (u) => {
        setAccount(u ? toAccount(u) : null)
        setStatus(u ? 'signed-in' : 'signed-out')
        store.set(SESSION, u ? '1' : null)
      })
    }
    return fb
  }, [])

  // Restore a saved session (or finish a redirect sign-in) without blocking the first paint.
  useEffect(() => {
    if (status !== 'checking') return
    const run = async () => {
      try {
        const fb = await connect()
        if (store.get(REDIRECT)) {
          store.set(REDIRECT, null)
          await fb.authMod.getRedirectResult(fb.auth)
        }
      } catch {
        setStatus('signed-out')
      }
    }
    void run()
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const prepare = useCallback(() => {
    if (authConfigured) connect().catch(() => {})
  }, [connect])

  const signInWith = useCallback(
    async (p: ProviderId) => {
      const fb = await connect()
      const { authMod: A, auth } = fb
      let provider
      if (p === 'google') {
        provider = new A.GoogleAuthProvider()
        provider.setCustomParameters({ prompt: 'select_account' })
      } else if (p === 'facebook') {
        provider = new A.FacebookAuthProvider()
        provider.addScope('email')
      } else {
        provider = new A.OAuthProvider('apple.com')
        provider.addScope('email')
        provider.addScope('name')
      }
      try {
        await A.signInWithPopup(auth, provider)
      } catch (e) {
        const code = (e as { code?: string }).code
        // Popups blocked (some in-app browsers): fall back to a full-page redirect.
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
          store.set(REDIRECT, '1')
          await A.signInWithRedirect(auth, provider)
          return
        }
        throw e
      }
    },
    [connect],
  )

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const { authMod: A, auth } = await connect()
      const cred = await A.createUserWithEmailAndPassword(auth, email.trim(), password)
      if (name.trim()) await A.updateProfile(cred.user, { displayName: name.trim() })
      setAccount(toAccount(cred.user))
      A.sendEmailVerification(cred.user).catch(() => {})
    },
    [connect],
  )

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { authMod: A, auth } = await connect()
      await A.signInWithEmailAndPassword(auth, email.trim(), password)
    },
    [connect],
  )

  const resetPassword = useCallback(
    async (email: string) => {
      const { authMod: A, auth } = await connect()
      await A.sendPasswordResetEmail(auth, email.trim())
    },
    [connect],
  )

  const signOut = useCallback(async () => {
    const { authMod: A, auth } = await connect()
    await A.signOut(auth)
  }, [connect])

  const deleteAccount = useCallback(
    async (beforeDelete?: (fb: Firebase, uid: string) => Promise<void>) => {
      const fb = await connect()
      const user = fb.auth.currentUser
      if (!user) return
      if (beforeDelete) await beforeDelete(fb, user.uid)
      await fb.authMod.deleteUser(user)
    },
    [connect],
  )

  const api = useMemo<AuthApi>(
    () => ({ status, account, firebase, prepare, signInWith, signUp, signIn, resetPassword, signOut, deleteAccount }),
    [status, account, firebase, prepare, signInWith, signUp, signIn, resetPassword, signOut, deleteAccount],
  )
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useAuth(): AuthApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth needs <AuthProvider>')
  return v
}
