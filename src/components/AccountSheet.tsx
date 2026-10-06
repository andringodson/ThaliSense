import { useEffect, useState } from 'react'
import { friendlyError, useAuth, type Account } from '../lib/auth'
import { wipe } from '../lib/sync'
import type { SyncStatus } from '../lib/useSync'
import { Icon } from './ui'

const PROVIDER: Record<string, string> = {
  'google.com': 'Google',
  'facebook.com': 'Facebook',
  'apple.com': 'Apple',
  password: 'email and password',
}

export function Avatar({ account, size = 32 }: { account: Account; size?: number }) {
  const [broken, setBroken] = useState(false)
  if (account.photo && !broken)
    return <img className="avatar" src={account.photo} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(true)} />
  return (
    <span className="avatar initials" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {account.name.slice(0, 1).toUpperCase()}
    </span>
  )
}

function ago(t: number | null) {
  if (!t) return ''
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s} s ago`
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  return new Date(t).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function syncLabel(status: SyncStatus, last: number | null) {
  if (status === 'syncing') return 'Syncing…'
  if (status === 'offline') return 'Offline. Changes are saved here and will sync when you’re back online.'
  if (status === 'error') return 'Couldn’t sync just now.'
  if (status === 'synced') return `Backed up ${ago(last)}`
  return 'Not synced yet'
}

export function AccountSheet({ status, lastSynced, onSyncNow, onClose, onClearDevice }: {
  status: SyncStatus
  lastSynced: number | null
  onSyncNow: () => void
  onClose: () => void
  /** Remove profile, meals and progress from this device. */
  onClearDevice: () => void
}) {
  const auth = useAuth()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, tick] = useState(0)
  const account = auth.account

  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 15_000)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('keydown', esc)
    }
  }, [onClose])

  if (!account) return null

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      onClose()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet account-sheet" role="dialog" aria-modal="true" aria-labelledby="account-title" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2 id="account-title">Your account</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>
        <div className="auth-body">
          <div className="account-id">
            <Avatar account={account} size={48} />
            <div>
              <b>{account.name}</b>
              <span className="muted small">{account.email ?? 'No email shared'} · signed in with {PROVIDER[account.provider] ?? account.provider}</span>
            </div>
          </div>

          <div className={`sync-row sync-${status}`}>
            <span className="sync-dot" aria-hidden="true" />
            <span className="small" role="status" aria-live="polite">{syncLabel(status, lastSynced)}</span>
            <button className="link small" onClick={onSyncNow} disabled={status === 'syncing'}>Sync now</button>
          </div>
          <p className="muted small">
            Your profile, meals, plans and progress are stored in your own private space, readable only when you’re signed in. Photos are never uploaded.
          </p>

          <div className="account-actions">
            <button className="btn" disabled={!!busy} onClick={() => void act('out', auth.signOut)}>
              {busy === 'out' ? 'Signing out…' : 'Sign out'}
            </button>
            <button
              className="btn"
              disabled={!!busy}
              onClick={() => void act('out-clear', async () => {
                await auth.signOut()
                onClearDevice()
              })}
            >
              Sign out and clear this device
            </button>
            <button
              className="btn danger"
              disabled={!!busy}
              onClick={() => {
                if (!confirm('Delete your account and all your data in the cloud and on this device? This can’t be undone.')) return
                void act('delete', async () => {
                  await auth.deleteAccount((fb, uid) => wipe(fb, uid))
                  onClearDevice()
                })
              }}
            >
              {busy === 'delete' ? 'Deleting…' : 'Delete account'}
            </button>
          </div>
          {error && <p className="error small" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  )
}
