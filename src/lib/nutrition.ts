import { FOOD_BY_ID, type Food } from '../data/foods'
import type { Targets } from './health'

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack']

export interface LogEntry {
  id: string
  /** Local date as YYYY-MM-DD. */
  date: string
  meal: Meal
  foodId: string
  /** Number of servings, so 2 rotis is qty 2 and half a cup of rice is 0.5. */
  qty: number
  source: 'text' | 'photo' | 'manual' | 'plan'
}

export interface Totals {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fibre: number
  cost: number
  /** Share of energy from foods with a high glycaemic index, 0 to 1. */
  highGiShare: number
  /** Share of energy from fried foods and sweets, 0 to 1. */
  friedSweetShare: number
}

export const ZERO: Totals = { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, cost: 0, highGiShare: 0, friedSweetShare: 0 }

export function sumItems(items: { food: Food; qty: number }[]): Totals {
  let kcal = 0, protein = 0, carbs = 0, fat = 0, fibre = 0, cost = 0, highGi = 0, friedSweet = 0
  for (const { food: f, qty } of items) {
    kcal += f.kcal * qty
    protein += f.protein * qty
    carbs += f.carbs * qty
    fat += f.fat * qty
    fibre += f.fibre * qty
    cost += f.cost * qty
    if (f.gi === 'high') highGi += f.kcal * qty
    if (f.tags.includes('fried') || f.tags.includes('sweet')) friedSweet += f.kcal * qty
  }
  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    fibre: Math.round(fibre),
    cost: Math.round(cost),
    highGiShare: kcal ? highGi / kcal : 0,
    friedSweetShare: kcal ? friedSweet / kcal : 0,
  }
}

export function totals(entries: LogEntry[]): Totals {
  return sumItems(
    entries.flatMap((e) => (FOOD_BY_ID[e.foodId] ? [{ food: FOOD_BY_ID[e.foodId], qty: e.qty }] : [])),
  )
}

/**
 * Plate score, 0 to 100: how balanced a meal is, regardless of its size.
 * Starts at 100 and loses points for a high-GI or fried and sweet share of
 * energy, protein under 15% of energy, and fibre under 1.5 g per 100 kcal.
 */
export function plateScore(t: Totals): { score: number; band: 'good' | 'watch' | 'high'; why: string[] } {
  if (!t.kcal) return { score: 0, band: 'watch', why: [] }
  const why: string[] = []
  let s = 100
  const gi = Math.round(t.highGiShare * 35)
  if (gi >= 8) why.push('fast-acting carbs')
  const fs = Math.round(t.friedSweetShare * 45)
  if (fs >= 8) why.push('fried or sweet')
  const proteinShare = (t.protein * 4) / t.kcal
  const pr = proteinShare < 0.15 ? Math.round(((0.15 - proteinShare) / 0.15) * 25) : 0
  if (pr >= 8) why.push('low protein')
  const fibre = (t.fibre / t.kcal) * 100
  const fb = fibre < 1.5 ? Math.round(((1.5 - fibre) / 1.5) * 15) : 0
  if (fb >= 6) why.push('low fibre')
  s -= gi + fs + pr + fb
  const score = Math.max(0, Math.min(100, s))
  return { score, band: score >= 75 ? 'good' : score >= 55 ? 'watch' : 'high', why }
}

export function progress(t: Totals, target: Targets) {
  return {
    kcal: t.kcal / target.kcal,
    protein: t.protein / target.protein,
    carbs: t.carbs / target.carbs,
    fat: t.fat / target.fat,
    fibre: t.fibre / target.fibre,
  }
}

export function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function daysBack(n: number, from: Date = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(from)
    d.setDate(d.getDate() - (n - 1 - i))
    return isoDate(d)
  })
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}

/** Guess the meal slot from the clock, used when logging without picking one. */
export function mealForHour(h: number): Meal {
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 19) return 'snack'
  return 'dinner'
}
