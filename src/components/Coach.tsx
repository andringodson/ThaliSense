import { useEffect, useRef, useState } from 'react'
import type { CoachReport } from '../lib/agent'
import { daysBack, totals, type LogEntry } from '../lib/nutrition'
import { Card, Chip, Icon, qtyLabel } from './ui'

const TOOL_LABEL: Record<string, string> = {
  assess_profile: 'Assess profile',
  review_logs: 'Review last 7 days',
  detect_patterns: 'Detect patterns',
  suggest_swaps: 'Suggest swaps',
  plan_week: 'Draft 7-day plan',
  verify_plan: 'Verify & repair plan',
  check_budget: 'Check budget',
  set_nudges: 'Pick habits',
}

function WeekChart({ logs, target }: { logs: LogEntry[]; target: number }) {
  const days = daysBack(7)
  const data = days.map((d) => ({ d, t: totals(logs.filter((l) => l.date === d)) }))
  const max = Math.max(target * 1.3, ...data.map((x) => x.t.kcal))
  const H = 120
  const plot = H - 22
  return (
    <figure className="weekchart" aria-label="Calories per day for the last 7 days">
      <div className="bars" style={{ height: H }}>
        <div className="target-line" style={{ bottom: (target / max) * plot }}>
          <span className="small muted">target {target}</span>
        </div>
        {data.map(({ d, t }) => {
          const h = (t.kcal / max) * plot
          const over = t.kcal > target * 1.1
          return (
            <div key={d} className="bar-col" title={`${d}: ${t.kcal} kcal, ${t.protein} g protein`}>
              <span className="bar-val num small">{t.kcal || ''}</span>
              <div className={`bar ${t.kcal === 0 ? 'none' : over ? 'over' : ''}`} style={{ height: Math.max(2, h) }} />
            </div>
          )
        })}
      </div>
      <div className="bar-labels">
        {data.map(({ d }) => (
          <span key={d} className="small muted">{new Date(d + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short' })}</span>
        ))}
      </div>
    </figure>
  )
}

export function Coach({ report, logs, onRun, onOpenPlan }: { report: CoachReport | null; logs: LogEntry[]; onRun: () => void; onOpenPlan: () => void }) {
  const [shown, setShown] = useState(report ? report.trace.length : 0)
  const [running, setRunning] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  // Reveal trace steps one at a time so the reasoning can be followed.
  useEffect(() => {
    if (!running || !report) return
    if (shown >= report.trace.length) {
      setRunning(false)
      return
    }
    timer.current = window.setTimeout(() => setShown((s) => s + 1), 420)
    return () => window.clearTimeout(timer.current)
  }, [running, shown, report])

  const start = () => {
    onRun()
    setShown(0)
    setRunning(true)
  }

  const done = report && shown >= report.trace.length

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">On-device agent</p>
          <h1>Your coach</h1>
        </div>
        <button className="btn primary" onClick={start} disabled={running}>
          <Icon name="spark" size={16} /> {report ? 'Run again' : 'Run coach'}
        </button>
      </header>

      {report && (
        <Card title="Last 7 days">
          <WeekChart logs={logs} target={report.assessment.targets.kcal} />
        </Card>
      )}

      {!report && (
        <Card className="hero-card">
          <p>
            The coach reads your profile and the last week of meals, finds what matters most, suggests swaps for foods you already eat,
            then drafts, checks and repairs a 7-day plan in your regional cuisine and budget. Every step is shown below.
          </p>
          <button className="btn primary" onClick={start}><Icon name="spark" size={16} /> Run coach</button>
        </Card>
      )}

      {report && (
        <Card title="Agent trace" action={<span className="muted small">{Math.min(shown, report.trace.length)} / {report.trace.length} steps</span>}>
          <ol className="trace">
            {report.trace.slice(0, shown).map((s, i) => (
              <li key={i} className={`step status-${s.status}`}>
                <span className="step-dot">{s.status === 'fix' ? '↻' : s.status === 'warn' ? '!' : <Icon name="check" size={12} />}</span>
                <div>
                  <div className="step-head">
                    <code>{s.tool}</code>
                    <b>{TOOL_LABEL[s.tool] ?? s.tool}</b>
                  </div>
                  <p className="muted small">{s.thought}</p>
                  <p className="obs">{s.observation}</p>
                </div>
              </li>
            ))}
            {running && <li className="step thinking"><span className="step-dot pulse" /><span className="muted small">Thinking…</span></li>}
          </ol>
        </Card>
      )}

      {done && (
        <>
          <div className="grid-2">
            <Card title="What the coach found">
              <ul className="insights">
                {report.insights.map((i) => (
                  <li key={i.id} className={`band-border-${i.band}`}>
                    <Chip band={i.band}>{i.band === 'good' ? 'Good' : i.band === 'watch' ? 'Watch' : 'Act'}</Chip>
                    <b>{i.title}</b>
                    <p className="muted small">{i.detail}</p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Habits for this week">
              <ul className="nudges">
                {report.nudges.map((n) => (
                  <li key={n.title}>
                    <b>{n.title}</b>
                    <p className="muted small">{n.detail}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {report.swaps.length > 0 && (
            <Card title="Swaps for foods you already eat">
              <ul className="swaps">
                {report.swaps.map((s) => (
                  <li key={s.from.id}>
                    <div className="swap-line">
                      <span className="swap-from">{s.from.name}</span>
                      <Icon name="arrow" size={16} />
                      <span className="swap-to">{s.to.map((t) => `${qtyLabel(t.qty)} ${t.food.name}`).join(' + ')}</span>
                    </div>
                    <div className="swap-impact num small">
                      <span className={s.kcalPerWeek < 0 ? 'good-text' : ''}>{s.kcalPerWeek > 0 ? '+' : ''}{s.kcalPerWeek} kcal</span>
                      {s.proteinPerWeek !== 0 && <span className={s.proteinPerWeek > 0 ? 'good-text' : ''}>{s.proteinPerWeek > 0 ? '+' : ''}{s.proteinPerWeek} g protein</span>}
                      {s.fibrePerWeek !== 0 && <span className={s.fibrePerWeek > 0 ? 'good-text' : ''}>{s.fibrePerWeek > 0 ? '+' : ''}{s.fibrePerWeek} g fibre</span>}
                      <span className="muted">per week · {s.timesPerWeek}× a week now</span>
                    </div>
                    <p className="muted small">{s.why}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <button className="btn primary wide" onClick={onOpenPlan}>See the 7-day plan <Icon name="arrow" size={16} /></button>
        </>
      )}
    </div>
  )
}
