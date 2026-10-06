import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { Today } from './components/Today'
import { Icon } from './components/ui'
import { runCoach, type CoachReport } from './lib/agent'
import { demoLogs, demoMeasures } from './lib/demo'
import { DEFAULT_PROFILE, assess, type Measure, type Profile } from './lib/health'
import { isoDate, mealForHour, uid, type LogEntry, type Meal } from './lib/nutrition'
import { useInstallPrompt } from './lib/pwa'
import { prefetchIfFast } from './vision/client'
import { usePersistent } from './lib/store'

// Only Today is needed for the first paint; the other screens load on demand.
const Coach = lazy(() => import('./components/Coach').then((m) => ({ default: m.Coach })))
const Plan = lazy(() => import('./components/Plan').then((m) => ({ default: m.Plan })))
const Health = lazy(() => import('./components/Health').then((m) => ({ default: m.Health })))
const SnapSheet = lazy(() => import('./components/SnapSheet').then((m) => ({ default: m.SnapSheet })))

/** Warm the other screens' code once the browser is idle, so tab switches are instant. */
function prefetchScreens() {
  const go = () => {
    void import('./components/Coach')
    void import('./components/Plan')
    void import('./components/Health')
    void import('./components/SnapSheet')
  }
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 3000 })
  else setTimeout(go, 1500)
}

type Tab = 'today' | 'coach' | 'plan' | 'me'
const TABS: { id: Tab; label: string; icon: 'today' | 'coach' | 'plan' | 'me' }[] = [
  { id: 'today', label: 'Today', icon: 'today' },
  { id: 'coach', label: 'Coach', icon: 'coach' },
  { id: 'plan', label: 'Plan', icon: 'plan' },
  { id: 'me', label: 'Health', icon: 'me' },
]

function Logo({ size = 28 }: { size?: number }) {
  // A thali from above: plate, three katoris and a roti.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="var(--accent)" strokeWidth="2" />
      <circle cx="11" cy="11" r="3.6" fill="var(--accent)" />
      <circle cx="21" cy="11" r="3.6" fill="var(--good)" />
      <circle cx="11" cy="21" r="3.6" fill="var(--watch)" />
      <circle cx="21" cy="21" r="4.2" fill="none" stroke="var(--text)" strokeWidth="1.6" />
    </svg>
  )
}

function Welcome({ onDemo, onStart }: { onDemo: () => void; onStart: () => void }) {
  return (
    <main className="welcome">
      <div className="welcome-inner">
        <div className="brand big-brand"><Logo size={44} /><span>ThaliSense</span></div>
        <h1>Eat the food you love.<br /><span className="accent-text">Know what it does to you.</span></h1>
        <p className="lede">
          An AI nutrition coach built for Indian meals. Type “2 roti, dal, bhindi” or snap your thali, see your diabetes risk with
          Indian-specific science, and let an on-device agent plan a week of regional meals that fit your body and budget.
        </p>
        <div className="welcome-cta">
          <button className="btn primary big" onClick={onDemo}><Icon name="spark" size={18} /> Try with a demo week</button>
          <button className="btn big" onClick={onStart}>Set up my profile</button>
        </div>
        <ul className="welcome-points">
          <li><b>108 Indian dishes</b><span>Idli to rajma, in Hindi, Tamil and English names</span></li>
          <li><b>Photo recognition</b><span>CLIP vision model running in your browser</span></li>
          <li><b>Explainable agent</b><span>Every step of its reasoning is shown</span></li>
          <li><b>100% private</b><span>No account, no server, nothing uploaded</span></li>
        </ul>
        <p className="muted small">101 million Indians live with diabetes and 136 million more with prediabetes (ICMR-INDIAB, Lancet Diabetes & Endocrinology 2023).</p>
      </div>
    </main>
  )
}

export default function App() {
  const [profile, setProfile] = usePersistent<Profile | null>('ts.profile', null)
  const [logs, setLogs] = usePersistent<LogEntry[]>('ts.logs', [])
  const [measures, setMeasures] = usePersistent<Measure[]>('ts.measures', [])
  const [tab, setTab] = useState<Tab>(() => {
    const t = new URLSearchParams(location.search).get('tab')
    return TABS.some((x) => x.id === t) ? (t as Tab) : 'today'
  })
  const install = useInstallPrompt()
  useEffect(() => {
    prefetchScreens()
    prefetchIfFast()
  }, [])
  const [meal, setMeal] = useState<Meal>(mealForHour(new Date().getHours()))
  const [snap, setSnap] = useState(false)
  const [report, setReport] = useState<CoachReport | null>(null)
  const closeSnap = useCallback(() => setSnap(false), [])

  const today = isoDate()
  const todays = useMemo(() => logs.filter((l) => l.date === today), [logs, today])
  const assessment = useMemo(() => (profile ? assess(profile) : null), [profile])

  const add = useCallback(
    (items: { foodId: string; qty: number }[], source: LogEntry['source'], m: Meal = meal) => {
      setLogs((prev) => {
        const next = [...prev]
        for (const i of items) {
          const k = next.findIndex((l) => l.date === today && l.meal === m && l.foodId === i.foodId)
          if (k >= 0) next[k] = { ...next[k], qty: next[k].qty + i.qty }
          else next.push({ id: uid(), date: today, meal: m, foodId: i.foodId, qty: i.qty, source })
        }
        return next
      })
    },
    [meal, today, setLogs],
  )

  const loadDemo = () => {
    setProfile(DEFAULT_PROFILE)
    setLogs(demoLogs())
    setMeasures(demoMeasures())
    setReport(null)
    setTab('today')
  }

  const plan = useMemo(() => report ?? (profile && tab === 'plan' ? runCoach(profile, logs) : null), [report, profile, logs, tab])

  if (!profile || !assessment) {
    return <Welcome onDemo={loadDemo} onStart={() => { setProfile({ ...DEFAULT_PROFILE, name: 'You' }); setLogs([]); setTab('me') }} />
  }

  return (
    <div className="app">
      <nav className="nav" aria-label="Main">
        <div className="brand"><Logo /><span>ThaliSense</span></div>
        <div className="nav-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        {install && (
          <button className="btn small install" onClick={install}>
            <Icon name="plus" size={14} /> Install app
          </button>
        )}
        <p className="nav-foot muted small"><Icon name="shield" size={14} /> On-device · private</p>
      </nav>

      <main className="main">
        <Suspense fallback={<div className="screen-loading" aria-busy="true" />}>
        {tab === 'today' && (
          <Today
            profile={profile}
            assessment={assessment}
            entries={todays}
            meal={meal}
            onMeal={setMeal}
            onAdd={add}
            onQty={(id, qty) => setLogs((p) => p.map((l) => (l.id === id ? { ...l, qty } : l)))}
            onRemove={(id) => setLogs((p) => p.filter((l) => l.id !== id))}
            onSnap={() => setSnap(true)}
            onOpenCoach={() => setTab('coach')}
          />
        )}
        {tab === 'coach' && <Coach report={report} logs={logs} onRun={() => setReport(runCoach(profile, logs))} onOpenPlan={() => setTab('plan')} />}
        {tab === 'plan' && plan && <Plan report={plan} onLog={(items, src, m) => add(items, src, m)} />}
        {tab === 'me' && (
          <Health
            profile={profile}
            assessment={assessment}
            measures={measures}
            onMeasure={(m) => {
              setMeasures((prev) => [...prev.filter((x) => x.date !== m.date), m].sort((a, b) => a.date.localeCompare(b.date)))
              setProfile({ ...profile, weightKg: m.weightKg, waistCm: m.waistCm })
              setReport(null)
            }}
            onChange={(p) => { setProfile(p); setReport(null) }}
            onDemo={loadDemo}
            onClear={() => { setProfile(null); setLogs([]); setMeasures([]); setReport(null) }}
          />
        )}
        </Suspense>
      </main>

      {snap && (
        <Suspense fallback={null}>
          <SnapSheet meal={meal} diet={profile.diet} onClose={closeSnap} onAdd={(items, src) => add(items, src)} />
        </Suspense>
      )}
    </div>
  )
}
