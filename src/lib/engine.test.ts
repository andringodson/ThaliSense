import { describe, expect, it } from 'vitest'
import { FOODS, FOOD_BY_ID } from '../data/foods'
import { TEMPLATES, SWAPS } from '../data/templates'
import { runCoach, suggestNext } from './agent'
import { demoLogs } from './demo'
import { DEFAULT_PROFILE, assess, bmiClass, idrs, type Profile } from './health'
import { parseMeal } from './parser'

describe('food data', () => {
  it('has unique ids and sane energy', () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length)
    for (const f of FOODS) {
      // Energy from macros should be within reach of the stated kcal.
      const fromMacros = f.protein * 4 + f.carbs * 4 + f.fat * 9
      expect(Math.abs(fromMacros - f.kcal) / f.kcal, f.id).toBeLessThan(0.25)
    }
  })

  it('templates and swaps only reference known foods', () => {
    for (const t of TEMPLATES) for (const [id] of t.items) expect(FOOD_BY_ID[id], `${t.id}:${id}`).toBeDefined()
    for (const s of SWAPS) {
      expect(FOOD_BY_ID[s.from], s.from).toBeDefined()
      for (const [id] of s.to) expect(FOOD_BY_ID[id], id).toBeDefined()
    }
  })
})

describe('health', () => {
  it('uses Asian BMI cut-offs', () => {
    expect(bmiClass(22.9).label).toBe('Normal')
    expect(bmiClass(23.5).label).toBe('Overweight')
    expect(bmiClass(26).band).toBe('high')
  })

  it('scores IDRS like the MDRF questionnaire', () => {
    expect(idrs({ age: 30, sex: 'male', waistCm: 85, activity: 'vigorous', familyHistory: 'none' }).score).toBe(0)
    const r = idrs({ age: 52, sex: 'female', waistCm: 92, activity: 'sedentary', familyHistory: 'both' })
    expect(r.score).toBe(100)
    expect(r.band).toBe('high')
    expect(idrs({ age: 40, sex: 'female', waistCm: 85, activity: 'moderate', familyHistory: 'none' }).score).toBe(40)
  })

  it('never sets a target below the safe floor', () => {
    const tiny: Profile = { ...DEFAULT_PROFILE, heightCm: 148, weightKg: 52, age: 60 }
    expect(assess(tiny).targets.kcal).toBeGreaterThanOrEqual(1200)
  })
})

describe('parser', () => {
  const ids = (s: string) => parseMeal(s).items.map((i) => [i.foodId, i.qty])

  it('reads quantities and plurals', () => {
    expect(ids('2 rotis, 1 katori dal and half cup rice')).toEqual([['roti', 2], ['dal', 1], ['rice', 0.5]])
  })

  it('prefers the longest dish name', () => {
    expect(ids('curd rice')).toEqual([['curd-rice', 1]])
    expect(ids('3 idli with sambar')).toEqual([['idli', 3], ['sambar', 1]])
    expect(ids('egg curry and 2 chapathi')).toEqual([['egg-curry', 1], ['roti', 2]])
  })

  it('handles Hindi and Tamil words and typos', () => {
    expect(ids('do roti aur dahi')).toEqual([['roti', 2], ['curd', 1]])
    expect(ids('rendu dosai')).toEqual([['dosa', 2]])
    expect(ids('chappati')[0][0]).toBe('roti')
    expect(ids('biriyani')[0][0]).toBe('chicken-biryani')
  })

  it('converts grams', () => {
    expect(ids('200g paneer')).toEqual([['paneer', 2]])
  })

  it('reports what it could not read', () => {
    expect(parseMeal('xyzzy plorp').unmatched).toEqual(['xyzzy plorp'])
  })
})

describe('coach agent', () => {
  const today = new Date(2026, 9, 5)
  const report = runCoach(DEFAULT_PROFILE, demoLogs(today), today)

  it('runs every tool and records a trace', () => {
    expect(report.trace.map((t) => t.tool)).toEqual([
      'assess_profile', 'review_logs', 'detect_patterns', 'suggest_swaps', 'plan_week', 'verify_plan', 'check_budget', 'set_nudges',
    ])
  })

  it('finds the demo week problems', () => {
    const ids = report.insights.map((i) => i.id)
    expect(ids).toContain('carb-heavy')
    expect(ids).toContain('sugary-drinks')
    expect(report.swaps.length).toBeGreaterThan(0)
  })

  it('plans 7 vegetarian days near target', () => {
    const tg = report.assessment.targets
    expect(report.plan).toHaveLength(7)
    for (const d of report.plan) {
      for (const m of d.meals) for (const it of m.items) expect(it.food.diet, it.food.id).toBe('veg')
      expect(Math.abs(d.totals.kcal - tg.kcal) / tg.kcal, d.date).toBeLessThan(0.15)
      expect(d.totals.protein, d.date).toBeGreaterThan(tg.protein * 0.8)
    }
  })

  it('respects diet for every profile combination', () => {
    for (const diet of ['veg', 'egg', 'nonveg'] as const)
      for (const region of ['north', 'south', 'east', 'west'] as const) {
        const r = runCoach({ ...DEFAULT_PROFILE, diet, region }, [], today)
        expect(r.plan.every((d) => d.meals.length === 4)).toBe(true)
        if (diet !== 'nonveg')
          for (const d of r.plan) for (const m of d.meals) for (const it of m.items) expect(it.food.diet).not.toBe('nonveg')
      }
  })

  it('suggests a next meal', () => {
    expect(suggestNext(DEFAULT_PROFILE, [], 'dinner').length).toBe(3)
  })
})
