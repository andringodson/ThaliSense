import type { ReactNode } from 'react'
import type { Band } from '../lib/health'

export function Ring({ value, max, size = 168, stroke = 14, children }: { value: number; max: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const ratio = max ? value / max : 0
  const over = ratio > 1.05
  const shown = Math.min(1, ratio)
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? 'var(--high)' : 'var(--accent)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * shown} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 600ms cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  )
}

export function Meter({ label, value, target, unit = 'g', invert = false }: { label: string; value: number; target: number; unit?: string; invert?: boolean }) {
  const ratio = target ? value / target : 0
  // For carbs and fat, going over is the problem; for protein and fibre, falling short is.
  const band: Band = invert ? (ratio > 1.15 ? 'high' : ratio > 1 ? 'watch' : 'good') : ratio >= 0.9 ? 'good' : ratio >= 0.6 ? 'watch' : 'high'
  return (
    <div className="meter">
      <div className="meter-head">
        <span>{label}</span>
        <span className="num">
          {Math.round(value)}
          <span className="muted"> / {target}{unit}</span>
        </span>
      </div>
      <div className="meter-track">
        <div className={`meter-fill band-${band}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
    </div>
  )
}

export function Chip({ band, children }: { band: Band; children: ReactNode }) {
  return <span className={`chip band-${band}`}>{children}</span>
}

export function Stepper({ value, onChange, step = 0.5, min = 0.25 }: { value: number; onChange: (v: number) => void; step?: number; min?: number }) {
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, ''))
  return (
    <span className="stepper">
      <button type="button" aria-label="Less" onClick={() => onChange(Math.max(min, value - step))}>−</button>
      <span className="num">{fmt(value)}</span>
      <button type="button" aria-label="More" onClick={() => onChange(value + step)}>+</button>
    </span>
  )
}

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export const qtyLabel = (qty: number) => (Number.isInteger(qty) ? `${qty}` : qty === 0.5 ? '½' : qty === 0.25 ? '¼' : qty === 0.75 ? '¾' : qty.toFixed(2).replace(/0$/, ''))

export function Icon({ name, size = 20 }: { name: 'today' | 'coach' | 'plan' | 'me' | 'camera' | 'plus' | 'x' | 'spark' | 'check' | 'arrow' | 'trash' | 'shield'; size?: number }) {
  const p: Record<string, ReactNode> = {
    today: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
    coach: <><path d="M12 3l2.2 5.3L20 9l-4.3 3.8L17 18.5 12 15.5 7 18.5l1.3-5.7L4 9l5.8-.7z" /></>,
    plan: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
    me: <><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
    camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    x: <path d="M6 6l12 12M18 6L6 18" />,
    spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    trash: <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />,
    shield: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {p[name]}
    </svg>
  )
}
