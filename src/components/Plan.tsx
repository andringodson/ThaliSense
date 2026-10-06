import { useState } from 'react'
import type { CoachReport } from '../lib/agent'
import type { LogEntry, Meal } from '../lib/nutrition'
import { Card, Icon, Meter, qtyLabel } from './ui'

const TITLE: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' }

/** The week as plain text, for WhatsApp or the share sheet. */
function planText(report: CoachReport): string {
  const lines = [`*My 7-day meal plan from ThaliSense* (${report.assessment.targets.kcal} kcal a day)`, '']
  for (const d of report.plan) {
    lines.push(`*${d.label} ${new Date(d.date + 'T00:00').getDate()}*`)
    for (const m of d.meals) lines.push(`${TITLE[m.meal]}: ${m.items.map((i) => `${qtyLabel(i.qty)} ${i.food.name}`).join(', ')}`)
    lines.push('')
  }
  lines.push('Made with https://thalisense.vercel.app')
  return lines.join('\n')
}

async function sharePlan(report: CoachReport) {
  const text = planText(report)
  if (navigator.share) {
    try {
      await navigator.share({ title: 'My ThaliSense meal plan', text })
      return
    } catch {
      // Cancelled or unsupported: fall through to WhatsApp.
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}

export function Plan({ report, onLog }: { report: CoachReport; onLog: (items: { foodId: string; qty: number }[], source: LogEntry['source'], meal: Meal) => void }) {
  const [day, setDay] = useState(0)
  const [logged, setLogged] = useState<Set<string>>(new Set())
  const d = report.plan[day]
  const tg = report.assessment.targets
  const avg = (k: 'kcal' | 'protein' | 'fibre') => Math.round(report.plan.reduce((s, x) => s + x.totals[k], 0) / report.plan.length)
  const { weekCost, weekBudget } = report.budget

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">Built by your coach</p>
          <h1>7-day plan</h1>
        </div>
        <div className="head-stats num small">
          <span>{avg('kcal')} kcal/day</span>
          <span>{avg('protein')} g protein</span>
          <span className={weekCost > weekBudget ? 'warn-text' : 'good-text'}>₹{weekCost} / ₹{weekBudget} week</span>
          <button className="btn small" onClick={() => sharePlan(report)}><Icon name="arrow" size={14} /> Share plan</button>
        </div>
      </header>

      <div className="days" role="tablist" aria-label="Day">
        {report.plan.map((p, i) => (
          <button key={p.date} role="tab" aria-selected={i === day} className={i === day ? 'on' : ''} onClick={() => setDay(i)}>
            <span>{p.label}</span>
            <span className="num small">{new Date(p.date + 'T00:00').getDate()}</span>
            {p.revisions.length > 0 && <span className="dot" title="Adjusted by the coach" />}
          </button>
        ))}
      </div>

      <div className="plan-grid">
        <div className="plan-meals">
          {d.meals.map((m) => {
            const key = `${d.date}-${m.meal}`
            return (
              <Card key={m.meal} title={<><span className="eyebrow">{TITLE[m.meal]}</span> {m.name}</>} action={<span className="num muted small">{m.totals.kcal} kcal · {m.totals.protein} g P</span>}>
                <ul className="plan-items">
                  {m.items.map((it) => (
                    <li key={it.food.id}>
                      <span><b className="num">{qtyLabel(it.qty)}</b> × {it.food.name}</span>
                      <span className="muted small">{it.food.serving}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`btn small ${logged.has(key) ? 'done' : ''}`}
                  disabled={logged.has(key)}
                  onClick={() => {
                    onLog(m.items.map((i) => ({ foodId: i.food.id, qty: i.qty })), 'plan', m.meal)
                    setLogged(new Set(logged).add(key))
                  }}
                >
                  {logged.has(key) ? <><Icon name="check" size={14} /> Logged to today</> : <><Icon name="plus" size={14} /> Ate this today</>}
                </button>
              </Card>
            )
          })}
        </div>

        <aside className="plan-side">
          <Card title={`${d.label} totals`}>
            <p className="big num">{d.totals.kcal}<span className="muted small"> / {tg.kcal} kcal</span></p>
            <Meter label="Protein" value={d.totals.protein} target={tg.protein} />
            <Meter label="Fibre" value={d.totals.fibre} target={tg.fibre} />
            <Meter label="Carbs" value={d.totals.carbs} target={tg.carbs} invert />
            <Meter label="Fat" value={d.totals.fat} target={tg.fat} invert />
            <p className="muted small">About ₹{d.totals.cost} · {Math.round(d.totals.highGiShare * 100)}% energy from high-GI foods</p>
          </Card>
          {d.revisions.length > 0 && (
            <Card title={<><Icon name="spark" size={16} /> Coach adjusted this day</>}>
              <ul className="revisions">
                {d.revisions.map((r) => <li key={r} className="small">{r}</li>)}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}
