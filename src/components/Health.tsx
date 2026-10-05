import type { ChangeEvent, ReactNode } from 'react'
import type { Assessment, Profile } from '../lib/health'
import { Card, Chip, Icon } from './ui'

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="muted small">{hint}</span>}
    </label>
  )
}

function Scale({ value, min, max, marks, label }: { value: number; min: number; max: number; marks: { at: number; label: string }[]; label: string }) {
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))}%`
  return (
    <div className="scale" aria-label={label}>
      <div className="scale-track">
        <div className="scale-pin" style={{ left: pos(value) }} />
      </div>
      <div className="scale-marks">
        {marks.map((m) => (
          <span key={m.at} style={{ left: pos(m.at) }} className="small muted">{m.label}</span>
        ))}
      </div>
    </div>
  )
}

export function Health({ profile, assessment: a, onChange, onDemo, onClear }: {
  profile: Profile
  assessment: Assessment
  onChange: (p: Profile) => void
  onDemo: () => void
  onClear: () => void
}) {
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => onChange({ ...profile, [k]: v })
  const num = (k: 'age' | 'heightCm' | 'weightKg' | 'waistCm' | 'budget', min: number, max: number) => ({
    type: 'number' as const,
    inputMode: 'decimal' as const,
    min,
    max,
    value: profile[k],
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value)
      if (!Number.isNaN(v)) set(k, Math.min(max, Math.max(0, v)))
    },
  })

  return (
    <div className="screen">
      <header className="screen-head">
        <div>
          <p className="eyebrow">Profile & risk</p>
          <h1>Your health picture</h1>
        </div>
      </header>

      <div className="grid-2">
        <Card title="About you">
          <div className="form">
            <Field label="Name"><input value={profile.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <div className="row-2">
              <Field label="Age"><input {...num('age', 12, 100)} /></Field>
              <Field label="Sex">
                <select value={profile.sex} onChange={(e) => set('sex', e.target.value as Profile['sex'])}>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </Field>
            </div>
            <div className="row-3">
              <Field label="Height (cm)"><input {...num('heightCm', 100, 230)} /></Field>
              <Field label="Weight (kg)"><input {...num('weightKg', 25, 250)} /></Field>
              <Field label="Waist (cm)" hint="At the navel"><input {...num('waistCm', 40, 200)} /></Field>
            </div>
            <Field label="Physical activity">
              <select value={profile.activity} onChange={(e) => set('activity', e.target.value as Profile['activity'])}>
                <option value="sedentary">Sedentary: desk job, no exercise</option>
                <option value="mild">Mild: some walking or housework</option>
                <option value="moderate">Moderate: regular exercise or active work</option>
                <option value="vigorous">Vigorous: sport or heavy manual work</option>
              </select>
            </Field>
            <Field label="Parents with diabetes">
              <select value={profile.familyHistory} onChange={(e) => set('familyHistory', e.target.value as Profile['familyHistory'])}>
                <option value="none">Neither</option>
                <option value="one">One parent</option>
                <option value="both">Both parents</option>
              </select>
            </Field>
            <div className="row-2">
              <Field label="Diet">
                <select value={profile.diet} onChange={(e) => set('diet', e.target.value as Profile['diet'])}>
                  <option value="veg">Vegetarian</option>
                  <option value="egg">Eggetarian</option>
                  <option value="nonveg">Non-vegetarian</option>
                </select>
              </Field>
              <Field label="Cuisine">
                <select value={profile.region} onChange={(e) => set('region', e.target.value as Profile['region'])}>
                  <option value="south">South Indian</option>
                  <option value="north">North Indian</option>
                  <option value="east">East Indian</option>
                  <option value="west">West Indian</option>
                </select>
              </Field>
            </div>
            <div className="row-2">
              <Field label="Goal">
                <select value={profile.goal} onChange={(e) => set('goal', e.target.value as Profile['goal'])}>
                  <option value="lose">Lose weight gently</option>
                  <option value="maintain">Maintain weight</option>
                </select>
              </Field>
              <Field label="Food budget (₹/day)"><input {...num('budget', 50, 2000)} /></Field>
            </div>
          </div>
        </Card>

        <div className="stack">
          <Card title="Indian Diabetes Risk Score" action={<Chip band={a.idrsBand}>{a.idrs} / 100 · {a.idrsBand === 'good' ? 'Low' : a.idrsBand === 'watch' ? 'Moderate' : 'High'}</Chip>}>
            <ul className="idrs">
              {a.idrsParts.map((p) => (
                <li key={p.label}>
                  <span>{p.label}</span>
                  <span className="idrs-bar"><span style={{ width: `${(p.points / 30) * 100}%` }} /></span>
                  <span className="num small">{p.points}</span>
                </li>
              ))}
            </ul>
            <p className="muted small">
              The MDRF Indian Diabetes Risk Score (Mohan et al., 2005) screens for undiagnosed type 2 diabetes using four questions.
              60 or more is high risk and worth a blood test. {a.idrsBand === 'high' && <b>Please get a fasting glucose or HbA1c test.</b>}
            </p>
          </Card>

          <Card title="Body measures">
            <div className="measure">
              <div className="measure-head"><span>BMI</span><Chip band={a.bmiBand}>{a.bmi} · {a.bmiClass}</Chip></div>
              <Scale value={a.bmi} min={15} max={35} label="BMI scale" marks={[{ at: 18.5, label: '18.5' }, { at: 23, label: '23' }, { at: 25, label: '25' }, { at: 30, label: '30' }]} />
              <p className="muted small">Asian Indian cut-offs: overweight from 23 and obese from 25, lower than the global 25 and 30, because South Asians carry more risk at the same weight.</p>
            </div>
            <div className="measure">
              <div className="measure-head"><span>Waist-to-height</span><Chip band={a.whtrBand}>{a.whtr}</Chip></div>
              <Scale value={a.whtr} min={0.35} max={0.75} label="Waist to height scale" marks={[{ at: 0.5, label: '0.5' }, { at: 0.6, label: '0.6' }]} />
              <p className="muted small">Keep your waist under half your height. Belly fat predicts diabetes and heart risk better than weight alone.</p>
            </div>
          </Card>

          <Card title="Daily targets">
            <div className="targets num">
              <div><b>{a.targets.kcal}</b><span className="muted small">kcal</span></div>
              <div><b>{a.targets.protein}</b><span className="muted small">g protein</span></div>
              <div><b>{a.targets.fibre}</b><span className="muted small">g fibre</span></div>
              <div><b>{a.targets.carbs}</b><span className="muted small">g carbs max</span></div>
            </div>
            <p className="muted small">
              Resting {a.bmr} kcal, about {a.tdee} kcal with activity (Mifflin-St Jeor).
              {profile.goal === 'lose' && <> A gentle deficit gives roughly {Math.abs(a.weeklyChangeKg)} kg a week.</>}
            </p>
          </Card>
        </div>
      </div>

      <Card className="privacy">
        <div className="privacy-row">
          <Icon name="shield" size={28} />
          <div>
            <b>Your data never leaves this device.</b>
            <p className="muted small">
              No account, no server, no tracking. Meals and profile are stored in this browser only; photo recognition runs locally.
              ThaliSense is a wellness guide, not a medical device. Talk to a doctor before big diet changes, especially if you have diabetes, kidney disease or are pregnant.
            </p>
          </div>
        </div>
        <div className="privacy-actions">
          <button className="btn" onClick={onDemo}>Load demo week</button>
          <button className="btn danger" onClick={() => confirm('Delete your profile and all logged meals from this device?') && onClear()}>Delete my data</button>
        </div>
      </Card>
    </div>
  )
}
