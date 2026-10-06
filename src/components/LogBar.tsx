import { useMemo, useState } from 'react'
import { FOOD_BY_ID } from '../data/foods'
import { parseMeal } from '../lib/parser'
import { MEALS, type Meal } from '../lib/nutrition'
import { warmup } from '../vision/client'
import { Icon, qtyLabel } from './ui'

const EXAMPLES = ['3 idli, sambar and coffee', '2 roti, dal, bhindi, curd', 'chicken biryani with raita', 'do paratha aur dahi', '1.5 cup rice, rasam, poriyal']

export function LogBar({ meal, onMeal, onAdd, onSnap }: {
  meal: Meal
  onMeal: (m: Meal) => void
  onAdd: (items: { foodId: string; qty: number }[], source: 'text') => void
  onSnap: () => void
}) {
  const [text, setText] = useState('')
  const parsed = useMemo(() => parseMeal(text), [text])
  const kcal = parsed.items.reduce((s, i) => s + FOOD_BY_ID[i.foodId].kcal * i.qty, 0)
  const example = useMemo(() => EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)], [])

  const submit = () => {
    if (!parsed.items.length) return
    onAdd(parsed.items.map(({ foodId, qty }) => ({ foodId, qty })), 'text')
    setText('')
  }

  return (
    <div className="logbar">
      <div className="seg" role="tablist" aria-label="Meal">
        {MEALS.map((m) => (
          <button key={m} role="tab" aria-selected={m === meal} className={m === meal ? 'on' : ''} onClick={() => onMeal(m)}>
            {m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>
      <form
        className="logbar-input"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`What did you eat? e.g. ${example}`}
          aria-label="Describe your meal"
          autoComplete="off"
          enterKeyHint="done"
        />
        <button type="button" className="icon-btn" onClick={onSnap} onPointerEnter={warmup} onFocus={warmup} onTouchStart={warmup} aria-label="Log from a photo" title="Snap your thali">
          <Icon name="camera" />
        </button>
        <button type="submit" className="btn primary" disabled={!parsed.items.length}>
          Add
        </button>
      </form>
      {text.trim() && (
        <div className="parse-preview" aria-live="polite">
          {parsed.items.map((i) => (
            <span key={i.foodId} className={`pill ${i.confidence < 1 ? 'fuzzy' : ''}`} title={i.confidence < 1 ? `Best guess for "${i.text}"` : undefined}>
              <b>{qtyLabel(i.qty)}×</b> {FOOD_BY_ID[i.foodId].name}
              <span className="muted"> {Math.round(FOOD_BY_ID[i.foodId].kcal * i.qty)}</span>
            </span>
          ))}
          {parsed.unmatched.map((u) => (
            <span key={u} className="pill miss">? {u}</span>
          ))}
          {parsed.items.length > 0 && <span className="muted small">≈ {Math.round(kcal)} kcal · press Enter</span>}
        </div>
      )}
    </div>
  )
}
