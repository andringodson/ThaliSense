import { useEffect, useRef, useState } from 'react'
import { FOOD_BY_ID, allowed, type Diet } from '../data/foods'
import type { Meal } from '../lib/nutrition'
import { classify, isReady, onProgress, warmup, type Progress } from '../vision/client'
import { Icon, Stepper } from './ui'

type Candidate = { foodId: string; p: number; on: boolean; qty: number; companion?: boolean }

// CLIP names one dish per photo, so offer what usually shares the plate.
const COMPANIONS: Record<string, string[]> = {
  idli: ['sambar', 'coconut-chutney'],
  dosa: ['sambar', 'coconut-chutney'],
  'masala-dosa': ['sambar', 'coconut-chutney'],
  'rava-dosa': ['sambar', 'coconut-chutney'],
  uttapam: ['sambar', 'coconut-chutney'],
  'medu-vada': ['sambar', 'coconut-chutney'],
  pongal: ['sambar', 'coconut-chutney'],
  pesarattu: ['coconut-chutney'],
  appam: ['egg-curry', 'avial'],
  puttu: ['sundal', 'banana'],
  rice: ['sambar', 'dal', 'poriyal'],
  roti: ['dal', 'mixed-veg', 'salad'],
  paratha: ['curd'],
  'aloo-paratha': ['curd'],
  naan: ['paneer-butter-masala', 'dal-makhani'],
  bhatura: ['chole'],
  puri: ['aloo-sabzi'],
  'veg-biryani': ['raita'],
  'chicken-biryani': ['raita'],
  'mutton-biryani': ['raita'],
  'egg-biryani': ['raita'],
  chole: ['bhatura', 'roti'],
  rajma: ['rice'],
  'dal-makhani': ['naan', 'jeera-rice'],
  'pav-bhaji': [],
  samosa: ['chai'],
  pakora: ['chai'],
}

/** Downscale big phone photos before inference; CLIP only sees 224 px anyway. */
async function shrink(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 640 / Math.max(bmp.width, bmp.height))
  const canvas = new OffscreenCanvas(Math.round(bmp.width * scale), Math.round(bmp.height * scale))
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
}

export function SnapSheet({ meal, diet, onClose, onAdd }: {
  meal: Meal
  diet: Diet
  onClose: () => void
  onAdd: (items: { foodId: string; qty: number }[], source: 'photo') => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cands, setCands] = useState<Candidate[]>([])
  const [ms, setMs] = useState<number | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const off = onProgress(setProgress)
    warmup()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => {
      off()
      window.removeEventListener('keydown', esc)
    }
  }, [onClose])

  const run = async (file: Blob) => {
    setError(null)
    setCands([])
    setPreview(URL.createObjectURL(file))
    setBusy(true)
    try {
      const { scores, ms } = await classify(await shrink(file))
      setMs(ms)
      // Keep likely dishes the user can eat; pre-tick the confident ones.
      const usable = scores.filter((s) => allowed(FOOD_BY_ID[s.foodId], diet) || s.p > 0.3)
      const top = usable[0]?.p ?? 0
      const picks: Candidate[] = usable.slice(0, 5).map((s, i) => ({ ...s, on: i === 0 || s.p > top * 0.5, qty: 1 }))
      const seen = new Set(picks.map((c) => c.foodId))
      for (const id of COMPANIONS[picks[0]?.foodId] ?? []) {
        if (seen.has(id) || !allowed(FOOD_BY_ID[id], diet)) continue
        seen.add(id)
        picks.push({ foodId: id, p: 0, on: false, qty: 1, companion: true })
      }
      setCands(picks)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const loading = !isReady() && progress && progress.total > 0
  const pct = progress && progress.total ? Math.round((progress.loaded / progress.total) * 100) : 0
  const chosen = cands.filter((c) => c.on)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Log a meal from a photo" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>Snap your thali</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>

        <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && run(e.target.files[0])} />

        {!preview ? (
          <button className="dropzone" onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files?.[0]
              if (f) run(f)
            }}>
            <Icon name="camera" size={36} />
            <b>Take or choose a photo</b>
            <span className="muted small">Works best with one dish in frame, from above</span>
          </button>
        ) : (
          <div className="snap-body">
            <img src={preview} alt="Your meal" className="snap-img" />
            <div className="snap-results">
              {busy && (
                <div className="scan">
                  <div className="scan-line" />
                  <span>{loading ? `Downloading the vision model, one time only… ${pct}%` : 'Recognising dishes…'}</span>
                  {loading && <div className="meter-track"><div className="meter-fill band-good" style={{ width: `${pct}%` }} /></div>}
                </div>
              )}
              {error && <p className="error">Could not read that photo: {error}</p>}
              {cands.length > 0 && (
                <>
                  <p className="muted small">Tick what is on your plate and set the servings.</p>
                  <ul className="cands">
                    {cands.map((c, i) => {
                      const f = FOOD_BY_ID[c.foodId]
                      return (
                        <li key={c.foodId} className={c.on ? 'on' : ''}>
                          <label>
                            <input type="checkbox" checked={c.on} onChange={() => setCands(cands.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))} />
                            <span className="cand-name">{f.name}<span className="muted small"> · {f.serving}</span></span>
                          </label>
                          {c.companion ? (
                            <span className="conf companion small" title="Usually eaten together">often with</span>
                          ) : (
                            <span className="conf" title="Model confidence">
                              <span className="conf-bar" style={{ width: `${Math.round(c.p * 100)}%` }} />
                              <span className="num small">{Math.round(c.p * 100)}%</span>
                            </span>
                          )}
                          <Stepper value={c.qty} step={f.tags.includes('staple') && f.serving.includes('piece') ? 1 : 0.5} onChange={(v) => setCands(cands.map((x, j) => (j === i ? { ...x, qty: v, on: true } : x)))} />
                        </li>
                      )
                    })}
                  </ul>
                  {ms !== null && <p className="muted small">Ran on this device in {ms} ms. The photo never left your phone.</p>}
                </>
              )}
            </div>
          </div>
        )}

        <footer className="sheet-foot">
          {preview && <button className="btn" onClick={() => input.current?.click()}>Another photo</button>}
          <button className="btn primary" disabled={!chosen.length} onClick={() => { onAdd(chosen.map(({ foodId, qty }) => ({ foodId, qty })), 'photo'); onClose() }}>
            Add {chosen.length || ''} to {meal}
          </button>
        </footer>
      </div>
    </div>
  )
}
