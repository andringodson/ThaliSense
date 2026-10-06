import { useMemo } from 'react'
import { FOOD_BY_ID } from '../data/foods'
import { suggestNext } from '../lib/agent'
import type { Assessment, Profile } from '../lib/health'
import { MEALS, plateScore, totals, type LogEntry, type Meal } from '../lib/nutrition'
import { LogBar } from './LogBar'
import { Card, Chip, Icon, Meter, PlateScore, Ring, Stepper, qtyLabel } from './ui'

const TITLE: Record<Meal, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' }

export function Today({ profile, assessment, entries, meal, onMeal, onAdd, onQty, onRemove, onSnap, onOpenCoach }: {
  profile: Profile
  assessment: Assessment
  entries: LogEntry[]
  meal: Meal
  onMeal: (m: Meal) => void
  onAdd: (items: { foodId: string; qty: number }[], source: LogEntry['source'], meal?: Meal) => void
  onQty: (id: string, qty: number) => void
  onRemove: (id: string) => void
  onSnap: () => void
  onOpenCoach: () => void
}) {
  const t = totals(entries)
  const tg = assessment.targets
  const left = tg.kcal - t.kcal
  const nextMeal = MEALS.find((m) => !entries.some((e) => e.meal === m) && MEALS.indexOf(m) >= MEALS.indexOf(meal)) ?? meal
  const ideas = useMemo(() => suggestNext(profile, entries, nextMeal), [profile, entries, nextMeal])
  const hour = new Date().getHours()
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>{hello}, {profile.name.split(' ')[0]}</h1>
        </div>
        <div className="head-chips">
          <Chip band={assessment.idrsBand}>IDRS {assessment.idrs}</Chip>
          <Chip band={assessment.bmiBand}>BMI {assessment.bmi}</Chip>
        </div>
      </header>

      <LogBar meal={meal} onMeal={onMeal} onAdd={(items, src) => onAdd(items, src)} onSnap={onSnap} />

      <div className="today-grid">
        <Card className="summary">
          <div className="summary-row">
            <Ring value={t.kcal} max={tg.kcal}>
              <span className="big num">{Math.abs(left)}</span>
              <span className="muted small">{left >= 0 ? 'kcal left' : 'kcal over'}</span>
            </Ring>
            <div className="meters">
              <Meter label="Protein" value={t.protein} target={tg.protein} />
              <Meter label="Fibre" value={t.fibre} target={tg.fibre} />
              <Meter label="Carbs" value={t.carbs} target={tg.carbs} invert />
              <Meter label="Fat" value={t.fat} target={tg.fat} invert />
            </div>
          </div>
          <p className="muted small summary-foot">
            <span className="num">{t.kcal}</span> of <span className="num">{tg.kcal}</span> kcal · about ₹<span className="num">{t.cost}</span> of ₹{profile.budget}
            {t.kcal > 0 && t.highGiShare > 0.5 && <> · <span className="warn-text">{Math.round(t.highGiShare * 100)}% from high-GI foods</span></>}
          </p>
        </Card>

        <Card title={<>Next: {TITLE[nextMeal].toLowerCase()} ideas</>} action={<button className="link" onClick={onOpenCoach}>Full plan <Icon name="arrow" size={14} /></button>}>
          <p className="muted small">Picked by the coach for your remaining {Math.max(0, left)} kcal and {Math.max(0, tg.protein - t.protein)} g protein.</p>
          <ul className="ideas">
            {ideas.map((m) => (
              <li key={m.templateId}>
                <div>
                  <b>{m.name}</b>
                  <span className="muted small">{m.items.map((i) => `${qtyLabel(i.qty)} ${i.food.name}`).join(' · ')}</span>
                </div>
                <div className="idea-side">
                  <span className="num small">{m.totals.kcal} kcal · {m.totals.protein} g P</span>
                  <button className="btn small" onClick={() => onAdd(m.items.map((i) => ({ foodId: i.food.id, qty: i.qty })), 'plan', nextMeal)}>
                    <Icon name="plus" size={14} /> Log
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="meals">
        {MEALS.map((m) => {
          const list = entries.filter((e) => e.meal === m)
          const mt = totals(list)
          return (
            <Card key={m} title={TITLE[m]} action={<span className="card-meta"><span className="num muted small">{mt.kcal} kcal</span>{list.length > 0 && <PlateScore {...plateScore(mt)} />}</span>} className={list.length ? '' : 'empty'}>
              {list.length ? (
                <ul className="entries">
                  {list.map((e) => {
                    const f = FOOD_BY_ID[e.foodId]
                    if (!f) return null
                    return (
                      <li key={e.id}>
                        <span className="entry-name">
                          {f.name}
                          <span className="muted small">{f.serving}{e.source === 'photo' ? ' · from photo' : ''}</span>
                        </span>
                        <Stepper value={e.qty} onChange={(v) => onQty(e.id, v)} step={f.serving.includes('piece') || f.serving.includes('egg') ? 1 : 0.5} />
                        <span className="num small entry-kcal">{Math.round(f.kcal * e.qty)}</span>
                        <button className="icon-btn subtle" onClick={() => onRemove(e.id)} aria-label={`Remove ${f.name}`}><Icon name="trash" size={16} /></button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <button className="link muted" onClick={() => onMeal(m)}>Nothing logged yet. Log {m}</button>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
