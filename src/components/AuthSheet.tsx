import { useEffect, useRef, useState, type FormEvent } from 'react'
import { friendlyError, useAuth } from '../lib/auth'
import { providers, type ProviderId } from '../lib/firebase'
import { Icon } from './ui'

function ProviderIcon({ id }: { id: ProviderId }) {
  if (id === 'google')
    return (
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
    )
  if (id === 'facebook')
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#fff" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.62 23.1 24 18.1 24 12.07z" />
      </svg>
    )
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M16.37 12.73c-.03-2.67 2.18-3.95 2.28-4.01-1.24-1.82-3.18-2.07-3.87-2.1-1.65-.17-3.21.97-4.05.97-.84 0-2.12-.95-3.49-.92-1.8.03-3.45 1.04-4.38 2.65-1.87 3.24-.48 8.03 1.34 10.66.89 1.29 1.95 2.73 3.34 2.68 1.34-.05 1.85-.87 3.47-.87 1.62 0 2.07.87 3.49.84 1.44-.03 2.36-1.31 3.24-2.6 1.02-1.49 1.44-2.94 1.47-3.01-.03-.01-2.82-1.08-2.84-4.29zM13.7 4.9c.74-.9 1.24-2.14 1.1-3.38-1.07.04-2.36.71-3.12 1.6-.69.79-1.29 2.06-1.13 3.27 1.19.09 2.41-.6 3.15-1.49z" />
    </svg>
  )
}

const LABEL: Record<ProviderId, string> = { google: 'Google', facebook: 'Facebook', apple: 'Apple' }

export function AuthSheet({ onClose, initialMode = 'signin' }: { onClose: () => void; initialMode?: 'signin' | 'signup' }) {
  const auth = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const first = useRef<HTMLButtonElement>(null)
  const { prepare, status } = auth

  // Fetch the SDK while the person reads the sheet, so the tap feels instant.
  useEffect(() => {
    prepare()
    first.current?.focus()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [prepare, onClose])

  useEffect(() => {
    if (status === 'signed-in') onClose()
  }, [status, onClose])

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    setError(null)
    setInfo(null)
    try {
      await fn()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'signup' && password.length < 8) return setError('Use at least 8 characters for your password.')
    void run('email', () => (mode === 'signup' ? auth.signUp(name, email, password) : auth.signIn(email, password)))
  }

  const forgot = () => {
    if (!email.trim()) return setError('Enter your email above, then tap “Forgot password?” again.')
    void run('reset', async () => {
      await auth.resetPassword(email)
      setInfo(`If an account uses ${email.trim()}, a reset link is on its way.`)
    })
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet auth-sheet" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2 id="auth-title">{mode === 'signup' ? 'Create your account' : 'Sign in to ThaliSense'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>
        <div className="auth-body">
          <p className="muted small">
            Optional. An account backs up your meals, plans and progress so you can use them on any device. Photos never leave your phone.
          </p>

          <div className="providers">
            {providers.map((p, i) => (
              <button
                key={p}
                ref={i === 0 ? first : undefined}
                className={`btn provider provider-${p}`}
                disabled={!!busy}
                onClick={() => void run(p, () => auth.signInWith(p))}
              >
                <ProviderIcon id={p} />
                <span>{busy === p ? 'Opening…' : `Continue with ${LABEL[p]}`}</span>
              </button>
            ))}
          </div>

          <div className="or"><span>or use email</span></div>

          <form className="form auth-form" onSubmit={submit} noValidate>
            {mode === 'signup' && (
              <label className="field">
                <span className="field-label">Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </label>
            )}
            <label className="field">
              <span className="field-label">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required />
            </label>
            <div className="field">
              <label className="field-label" htmlFor="auth-password">Password</label>
              <span className="password">
                <input
                  id="auth-password"
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  minLength={mode === 'signup' ? 8 : undefined}
                  aria-describedby={mode === 'signup' ? 'auth-password-hint' : undefined}
                  required
                />
                <button type="button" className="link small" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? 'Hide' : 'Show'}
                </button>
              </span>
              {mode === 'signup' && <span id="auth-password-hint" className="muted small">At least 8 characters</span>}
            </div>
            <button className="btn primary wide" type="submit" disabled={!!busy}>
              {busy === 'email' ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
            {mode === 'signin' && (
              <button type="button" className="link small forgot" onClick={forgot} disabled={!!busy}>
                Forgot password?
              </button>
            )}
          </form>

          <p className="auth-msg" role="status" aria-live="polite">
            {error && <span className="error">{error}</span>}
            {info && <span className="good-text">{info}</span>}
          </p>

          <p className="small auth-switch">
            {mode === 'signin' ? 'New here?' : 'Already have an account?'}{' '}
            <button type="button" className="link" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null) }}>
              {mode === 'signin' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </div>
        <footer className="sheet-foot auth-foot">
          <a className="muted small" href="/privacy.html" target="_blank" rel="noopener">Privacy</a>
          <button className="btn" onClick={onClose}>Continue without an account</button>
        </footer>
      </div>
    </div>
  )
}
