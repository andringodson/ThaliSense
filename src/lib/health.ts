import type { Diet, Region } from '../data/foods'

export type Sex = 'female' | 'male'
export type Activity = 'sedentary' | 'mild' | 'moderate' | 'vigorous'
export type FamilyHistory = 'none' | 'one' | 'both'
export type Goal = 'lose' | 'maintain'

export interface Profile {
  name: string
  age: number
  sex: Sex
  heightCm: number
  weightKg: number
  waistCm: number
  activity: Activity
  familyHistory: FamilyHistory
  diet: Diet
  region: Region
  /** Daily food budget in INR. */
  budget: number
  goal: Goal
}

export type Band = 'good' | 'watch' | 'high'

export interface Assessment {
  bmi: number
  bmiClass: string
  bmiBand: Band
  whtr: number
  whtrBand: Band
  idrs: number
  idrsBand: Band
  idrsParts: { label: string; points: number }[]
  bmr: number
  tdee: number
  targets: Targets
  /** kg per week at the target intake, negative means loss. */
  weeklyChangeKg: number
}

export interface Targets {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fibre: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * BMI classes use the Asian Indian cut-offs from the 2009 consensus statement
 * (Misra et al., JAPI): overweight from 23, obese from 25.
 */
export function bmiClass(bmi: number): { label: string; band: Band } {
  if (bmi < 18.5) return { label: 'Underweight', band: 'watch' }
  if (bmi < 23) return { label: 'Normal', band: 'good' }
  if (bmi < 25) return { label: 'Overweight', band: 'watch' }
  if (bmi < 30) return { label: 'Obese (class I)', band: 'high' }
  return { label: 'Obese (class II)', band: 'high' }
}

/** Waist-to-height ratio. 0.5 and above signals central obesity. */
export function whtrBand(whtr: number): Band {
  if (whtr < 0.5) return 'good'
  if (whtr < 0.6) return 'watch'
  return 'high'
}

/**
 * Indian Diabetes Risk Score (Mohan et al., JAPI 2005, Madras Diabetes
 * Research Foundation). Scores run 0 to 100 in steps of 10:
 * under 30 is low risk, 30 to 50 moderate, 60 and above high.
 */
export function idrs(p: Pick<Profile, 'age' | 'sex' | 'waistCm' | 'activity' | 'familyHistory'>) {
  const age = p.age < 35 ? 0 : p.age < 50 ? 20 : 30
  const [lo, hi] = p.sex === 'female' ? [80, 90] : [90, 100]
  const waist = p.waistCm < lo ? 0 : p.waistCm < hi ? 10 : 20
  const activity = { vigorous: 0, moderate: 10, mild: 20, sedentary: 30 }[p.activity]
  const family = { none: 0, one: 10, both: 20 }[p.familyHistory]
  const score = age + waist + activity + family
  const band: Band = score < 30 ? 'good' : score < 60 ? 'watch' : 'high'
  return {
    score,
    band,
    parts: [
      { label: 'Age', points: age },
      { label: 'Waist', points: waist },
      { label: 'Physical activity', points: activity },
      { label: 'Family history', points: family },
    ],
  }
}

const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  mild: 1.375,
  moderate: 1.55,
  vigorous: 1.725,
}

/** Mifflin-St Jeor resting energy expenditure, kcal/day. */
export function bmr(p: Pick<Profile, 'age' | 'sex' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age
  return Math.round(base + (p.sex === 'male' ? 5 : -161))
}

export function assess(p: Profile): Assessment {
  const h = p.heightCm / 100
  const bmi = p.weightKg / (h * h)
  const cls = bmiClass(bmi)
  const whtr = p.waistCm / p.heightCm
  const risk = idrs(p)
  const rest = bmr(p)
  const tdee = Math.round(rest * ACTIVITY_FACTOR[p.activity])

  // A 500 kcal daily deficit, never below a safe floor without supervision.
  const floor = p.sex === 'female' ? 1200 : 1500
  const kcal = p.goal === 'lose' ? Math.max(floor, tdee - 500) : tdee

  // Protein at 1 g/kg, using weight capped at BMI 25 so obesity does not
  // inflate the target. ICMR-NIN's adult RDA is 0.83 g/kg; this sits above it.
  const refWeight = Math.min(p.weightKg, 25 * h * h)
  const protein = Math.round(refWeight)

  // Carbohydrate at about 50% of energy and fat at no more than 30%, in line
  // with ICMR-NIN 2024 dietary guidelines; fibre at 15 g per 1000 kcal.
  const carbs = Math.round((kcal * 0.5) / 4)
  const fat = Math.round((kcal * 0.3) / 9)
  const fibre = Math.round((kcal / 1000) * 15)

  return {
    bmi: round1(bmi),
    bmiClass: cls.label,
    bmiBand: cls.band,
    whtr: Math.round(whtr * 100) / 100,
    whtrBand: whtrBand(whtr),
    idrs: risk.score,
    idrsBand: risk.band,
    idrsParts: risk.parts,
    bmr: rest,
    tdee,
    targets: { kcal, protein, carbs, fat, fibre },
    // About 7700 kcal per kg of body fat.
    weeklyChangeKg: round1(((kcal - tdee) * 7) / 7700),
  }
}

export const DEFAULT_PROFILE: Profile = {
  name: 'Priya',
  age: 38,
  sex: 'female',
  heightCm: 158,
  weightKg: 72,
  waistCm: 92,
  activity: 'sedentary',
  familyHistory: 'one',
  diet: 'veg',
  region: 'south',
  budget: 200,
  goal: 'lose',
}
