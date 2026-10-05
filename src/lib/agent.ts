import { FOOD_BY_ID, allowed, type Food } from '../data/foods'
import { SWAPS, TEMPLATES, type Template } from '../data/templates'
import { assess, type Assessment, type Band, type Profile, type Targets } from './health'
import { MEALS, daysBack, isoDate, sumItems, totals, type LogEntry, type Meal, type Totals } from './nutrition'

/*
 * ThaliSense coach agent.
 *
 * A goal-driven planner that works the way a dietitian would: read the
 * profile, review the week, spot patterns, propose swaps, draft a plan, check
 * the draft against the targets and fix what misses, then check the budget.
 * Every tool call is recorded as a trace step so the user can see why it
 * recommended what it did. It is deterministic and runs entirely on-device.
 */

export interface TraceStep {
  tool: string
  thought: string
  observation: string
  status: 'ok' | 'warn' | 'fix'
}

export interface Insight {
  id: string
  band: Band
  title: string
  detail: string
}

export interface Item {
  food: Food
  qty: number
}

export interface Swap {
  from: Food
  to: Item[]
  timesPerWeek: number
  kcalPerWeek: number
  proteinPerWeek: number
  fibrePerWeek: number
  why: string
}

export interface PlannedMeal {
  meal: Meal
  templateId: string
  name: string
  items: Item[]
  totals: Totals
}

export interface PlanDay {
  date: string
  label: string
  meals: PlannedMeal[]
  totals: Totals
  revisions: string[]
}

export interface Nudge {
  title: string
  detail: string
}

export interface CoachReport {
  assessment: Assessment
  trace: TraceStep[]
  insights: Insight[]
  swaps: Swap[]
  plan: PlanDay[]
  nudges: Nudge[]
  week: { daysLogged: number; average: Totals | null }
  budget: { weekCost: number; weekBudget: number }
}

export const SLOT_SHARE: Record<Meal, number> = { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 }

const FLEX_STEP: Record<string, number> = {
  rice: 0.25, 'brown-rice': 0.25, 'curd-rice': 0.25, khichdi: 0.25, pongal: 0.25, upma: 0.25, poha: 0.25,
  oats: 0.25, 'bisi-bele-bath': 0.25, 'ragi-mudde': 0.25, puttu: 0.25, dhokla: 0.5, 'aloo-paratha': 0.5,
  paratha: 0.5, uttapam: 0.5,
}

/** Small seeded PRNG so a plan is stable for a given day and profile. */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

const items = (t: Template): Item[] => t.items.map(([id, qty]) => ({ food: FOOD_BY_ID[id], qty }))

export function templateAllowed(t: Template, p: Profile) {
  return t.items.every(([id]) => allowed(FOOD_BY_ID[id], p.diet))
}

/** Scale a template's staple so the meal lands near `kcal`. */
export function scaleTemplate(t: Template, kcal: number): Item[] {
  const base = items(t)
  if (!t.flex) return base
  const baseKcal = sumItems(base).kcal
  return base.map((it) => {
    if (it.food.id !== t.flex) return it
    const step = FLEX_STEP[it.food.id] ?? 1
    const raw = it.qty + (kcal - baseKcal) / it.food.kcal
    const lo = Math.max(step, it.qty * 0.5)
    const hi = it.qty * 1.75 + step
    const qty = Math.min(hi, Math.max(lo, Math.round(raw / step) * step))
    return { ...it, qty }
  })
}

interface ScoreCtx {
  profile: Profile
  slotBudget: number
  riskHigh: boolean
  usedCount: Map<string, number>
  yesterday: Set<string>
  rand: () => number
}

function scoreTemplate(t: Template, c: ScoreCtx): number {
  if (!templateAllowed(t, c.profile)) return -Infinity
  const tot = sumItems(items(t))
  let s = 0
  if (t.regions === 'all') s += 0.3
  else if (t.regions.includes(c.profile.region)) s += 1
  else s -= 0.6
  s += 6 * ((tot.protein * 4) / Math.max(1, tot.kcal))
  s += 0.3 * ((tot.fibre / Math.max(1, tot.kcal)) * 100)
  s -= (c.riskHigh ? 1.5 : 0.8) * tot.highGiShare
  s -= 1.5 * tot.friedSweetShare
  const costShare = tot.cost / Math.max(1, c.slotBudget)
  if (costShare > 1) s -= (costShare - 1) * 1.5
  s -= 1.2 * (c.usedCount.get(t.id) ?? 0)
  if (c.yesterday.has(t.id)) s -= 2
  return s + c.rand() * 0.4
}

function planMeal(t: Template, meal: Meal, kcal: number): PlannedMeal {
  const its = scaleTemplate(t, kcal)
  return { meal, templateId: t.id, name: t.name, items: its, totals: sumItems(its) }
}

function dayTotals(meals: PlannedMeal[]) {
  return sumItems(meals.flatMap((m) => m.items))
}

const BOOSTERS: [string, number][] = [
  ['soya-curry', 0.5],
  ['boiled-egg', 2],
  ['sprouts', 1],
  ['paneer', 0.5],
  ['roasted-chana', 1],
  ['curd', 1],
]

/** Foods whose portion can shrink when a day runs over: staples first, then rich sides. */
const TRIMMABLE = (f: Food) => f.tags.includes('staple') || f.fat * 9 > f.kcal * 0.5

function retotal(day: PlanDay) {
  for (const m of day.meals) m.totals = sumItems(m.items)
  return dayTotals(day.meals)
}

/** Check a planned day against targets and repair it. Returns notes on what changed. */
function verifyDay(day: PlanDay, tg: Targets, p: Profile): string[] {
  const notes: string[] = []
  let t = retotal(day)

  // 1. Protein: add the leanest available booster to dinner, then lunch, then
  //    breakfast, a different one each time so the day stays varied.
  const used = new Set<string>()
  for (const slot of ['dinner', 'lunch', 'breakfast'] as Meal[]) {
    if (t.protein >= tg.protein * 0.92) break
    const booster = BOOSTERS.map(([id, qty]) => ({ food: FOOD_BY_ID[id], qty }))
      .find((b) => allowed(b.food, p.diet) && !used.has(b.food.id))
    const target = day.meals.find((m) => m.meal === slot)
    if (!booster || !target) continue
    used.add(booster.food.id)
    target.items = [...target.items, booster]
    notes.push(`Protein was ${t.protein} g of ${tg.protein} g, so added ${booster.qty} × ${booster.food.name} to ${slot}.`)
    t = retotal(day)
  }

  // 2. Energy: trim the biggest staple or rich side one step at a time until
  //    the day is within 6% of target, or grow lunch and dinner staples if short.
  const before = t.kcal
  for (let guard = 0; guard < 30 && t.kcal > tg.kcal * 1.06; guard++) {
    const candidates = day.meals
      .flatMap((m) => m.items)
      .filter((i) => TRIMMABLE(i.food))
      .map((i) => ({ i, step: FLEX_STEP[i.food.id] ?? (i.qty >= 1 ? 1 : 0.25) }))
      .filter(({ i, step }) => i.qty - step >= step)
      .sort((a, b) => b.i.food.kcal * b.step - a.i.food.kcal * a.step)
    if (!candidates.length) break
    candidates[0].i.qty -= candidates[0].step
    t = retotal(day)
  }
  for (let guard = 0; guard < 10 && t.kcal < tg.kcal * 0.92; guard++) {
    const flexes = day.meals
      .filter((m) => m.meal === 'lunch' || m.meal === 'dinner')
      .map((m) => m.items.find((i) => i.food.id === TEMPLATES.find((x) => x.id === m.templateId)?.flex))
      .filter((i): i is Item => !!i)
    if (!flexes.length) break
    const f = flexes[guard % flexes.length]
    f.qty += FLEX_STEP[f.food.id] ?? 1
    t = retotal(day)
  }
  if (Math.abs(t.kcal - before) >= 20) {
    notes.push(`Energy was ${before} kcal against ${tg.kcal}, so ${t.kcal < before ? 'trimmed' : 'increased'} staple portions (now ${t.kcal} kcal).`)
  }

  day.totals = t
  return notes
}

function reviewWeek(logs: LogEntry[], today: Date) {
  const dates = daysBack(7, today)
  const byDay = dates.map((d) => logs.filter((l) => l.date === d))
  const logged = byDay.filter((d) => d.length > 0)
  if (!logged.length) return { dates, byDay, logged, average: null as Totals | null }
  const dayTotals = logged.map(totals)
  const avg = (k: keyof Totals) => dayTotals.reduce((s, t) => s + t[k], 0) / dayTotals.length
  const average: Totals = {
    kcal: Math.round(avg('kcal')),
    protein: Math.round(avg('protein')),
    carbs: Math.round(avg('carbs')),
    fat: Math.round(avg('fat')),
    fibre: Math.round(avg('fibre')),
    cost: Math.round(avg('cost')),
    highGiShare: avg('highGiShare'),
    friedSweetShare: avg('friedSweetShare'),
  }
  return { dates, byDay, logged, average }
}

function findPatterns(week: ReturnType<typeof reviewWeek>, a: Assessment): Insight[] {
  const out: Insight[] = []
  const avg = week.average
  const tg = a.targets
  if (!avg) {
    out.push({
      id: 'no-logs',
      band: 'watch',
      title: 'No meals logged this week',
      detail: 'The plan below comes from your profile alone. Log a few days and the coach will tailor it to how you actually eat.',
    })
    return out
  }
  const n = week.logged.length
  const ratio = avg.kcal / tg.kcal
  if (ratio > 1.1) {
    out.push({
      id: 'over-kcal',
      band: ratio > 1.25 ? 'high' : 'watch',
      title: `About ${avg.kcal - tg.kcal} kcal a day over target`,
      detail: `You averaged ${avg.kcal} kcal across ${n} logged day${n > 1 ? 's' : ''}; your target is ${tg.kcal}. Over a week that is roughly ${(((avg.kcal - tg.kcal) * 7) / 7700).toFixed(1)} kg of potential gain.`,
    })
  }
  const carbShare = (avg.carbs * 4) / Math.max(1, avg.kcal)
  if (carbShare > 0.6) {
    out.push({
      id: 'carb-heavy',
      band: carbShare > 0.68 ? 'high' : 'watch',
      title: `${Math.round(carbShare * 100)}% of your energy comes from carbohydrate`,
      detail: 'ICMR-NIN guidance is to keep it nearer 50%. Usually the fix is a smaller rice or roti portion and a bigger katori of dal or sabzi, not cutting staples out.',
    })
  }
  const lowProteinDays = week.logged.filter((d) => totals(d).protein < tg.protein * 0.8).length
  if (avg.protein < tg.protein * 0.9 || lowProteinDays >= Math.ceil(n / 2)) {
    out.push({
      id: 'low-protein',
      band: 'watch',
      title: `Protein short on ${lowProteinDays} of ${n} days`,
      detail: `Average ${avg.protein} g against a target of ${tg.protein} g. Protein keeps you full and protects muscle while losing weight; dal, curd, sprouts, paneer, eggs or soya at every meal closes the gap.`,
    })
  } else {
    out.push({ id: 'protein-ok', band: 'good', title: 'Protein is on track', detail: `Average ${avg.protein} g a day against a ${tg.protein} g target.` })
  }
  if (avg.fibre < tg.fibre * 0.7) {
    out.push({
      id: 'low-fibre',
      band: 'watch',
      title: `Fibre is low at ${avg.fibre} g a day`,
      detail: `Target ${tg.fibre} g. A bowl of salad, sprouts or a guava a day adds 5 to 6 g each.`,
    })
  }
  if (avg.highGiShare > 0.5) {
    out.push({
      id: 'high-gi',
      band: a.idrsBand === 'high' ? 'high' : 'watch',
      title: `${Math.round(avg.highGiShare * 100)}% of calories are from high-GI foods`,
      detail:
        a.idrsBand === 'good'
          ? 'White rice, idli, dosa and refined flour raise blood sugar quickly. Pairing them with dal and vegetables slows that down.'
          : `With an Indian Diabetes Risk Score of ${a.idrs}, fast-rising carbs matter more for you. Pair them with dal and vegetables and eat them last.`,
    })
  }
  if (avg.friedSweetShare > 0.2) {
    out.push({
      id: 'fried-sweet',
      band: 'watch',
      title: `${Math.round(avg.friedSweetShare * 100)}% of calories are fried snacks or sweets`,
      detail: 'Keep these to the occasional treat. The swaps below show easy replacements.',
    })
  }
  const all = week.logged.flat()
  const sugaryDrinks = all
    .filter((l) => ['soft-drink', 'fruit-juice', 'lassi', 'chai', 'coffee'].includes(l.foodId))
    .reduce((s, l) => s + l.qty, 0)
  if (sugaryDrinks / n >= 2.5) {
    out.push({
      id: 'sugary-drinks',
      band: 'watch',
      title: `${(sugaryDrinks / n).toFixed(1)} sweetened drinks a day`,
      detail: 'Sweet chai, coffee and juice add up quietly: three cups of sugared chai is around 6 teaspoons of sugar.',
    })
  }
  const skipped = week.logged.filter((d) => !d.some((l) => l.meal === 'breakfast')).length
  if (skipped >= 3) {
    out.push({
      id: 'skip-breakfast',
      band: 'watch',
      title: `Breakfast skipped on ${skipped} days`,
      detail: 'Skipping breakfast often leads to bigger, later meals. A protein-rich breakfast such as pesarattu, eggs or poha with curd helps.',
    })
  }
  const vegDays = week.logged.filter((d) => d.some((l) => FOOD_BY_ID[l.foodId]?.tags.includes('veg'))).length
  if (vegDays >= Math.ceil(n * 0.7)) {
    out.push({ id: 'veg-good', band: 'good', title: 'Vegetables most days', detail: `Sabzi, poriyal or salad on ${vegDays} of ${n} days. Keep it up.` })
  }
  return out
}

function findSwaps(week: ReturnType<typeof reviewWeek>, p: Profile): Swap[] {
  const freq = new Map<string, number>()
  for (const l of week.logged.flat()) freq.set(l.foodId, (freq.get(l.foodId) ?? 0) + l.qty)
  const scale = 7 / Math.max(1, week.logged.length)
  const swaps: Swap[] = []
  for (const s of SWAPS) {
    const times = (freq.get(s.from) ?? 0) * scale
    if (times < 1) continue
    const to = s.to.map(([id, qty]) => ({ food: FOOD_BY_ID[id], qty }))
    if (!to.every((t) => allowed(t.food, p.diet))) continue
    const from = FOOD_BY_ID[s.from]
    const after = sumItems(to)
    swaps.push({
      from,
      to,
      timesPerWeek: Math.round(times),
      kcalPerWeek: Math.round((after.kcal - from.kcal) * times),
      proteinPerWeek: Math.round((after.protein - from.protein) * times),
      fibrePerWeek: Math.round((after.fibre - from.fibre) * times),
      why: s.why,
    })
  }
  return swaps.sort((a, b) => a.kcalPerWeek - b.kcalPerWeek).slice(0, 4)
}

function buildNudges(p: Profile, a: Assessment, insights: Insight[]): Nudge[] {
  const has = (id: string) => insights.some((i) => i.id === id)
  const n: Nudge[] = []
  if (a.idrsBand === 'high') {
    n.push({
      title: 'Get a blood sugar test this month',
      detail: `An Indian Diabetes Risk Score of ${a.idrs} is in the high-risk range. A fasting glucose or HbA1c test at any lab or PHC tells you where you stand. This app does not diagnose anything.`,
    })
  }
  if (p.activity === 'sedentary' || p.activity === 'mild') {
    n.push({ title: 'Walk 10 minutes after lunch and dinner', detail: 'A short walk after meals blunts the blood sugar rise and adds up to over two hours of activity a week.' })
  }
  if (has('high-gi') || has('carb-heavy') || a.idrsBand !== 'good') {
    n.push({ title: 'Eat sabzi and dal first, rice or roti last', detail: 'Eating vegetables and protein before carbohydrate lowers the after-meal glucose peak.' })
  }
  n.push({ title: 'Use the plate method', detail: 'Half the plate vegetables, a quarter dal, paneer, egg or fish, a quarter rice or roti.' })
  if (a.whtrBand !== 'good') {
    n.push({
      title: `Aim for a waist under ${Math.round(p.heightCm / 2)} cm`,
      detail: `That is half your height. You are at ${p.waistCm} cm now; measure every Sunday at the navel.`,
    })
  }
  if (has('sugary-drinks')) n.push({ title: 'Halve the sugar in chai', detail: 'Cut one spoon at a time; most people stop noticing within two weeks.' })
  return n.slice(0, 4)
}

const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function runCoach(p: Profile, logs: LogEntry[], today: Date = new Date()): CoachReport {
  const trace: TraceStep[] = []
  const a = assess(p)
  const tg = a.targets

  trace.push({
    tool: 'assess_profile',
    thought: 'Start from the body: what are the risk markers and what should a day of eating add up to?',
    observation: `BMI ${a.bmi} (${a.bmiClass}, Asian cut-offs), waist-to-height ${a.whtr}, IDRS ${a.idrs}. Target ${tg.kcal} kcal, ${tg.protein} g protein, ${tg.fibre} g fibre.`,
    status: a.idrsBand === 'high' || a.bmiBand === 'high' ? 'warn' : 'ok',
  })

  const week = reviewWeek(logs, today)
  trace.push({
    tool: 'review_logs',
    thought: 'Look at what was actually eaten over the last 7 days before recommending anything.',
    observation: week.average
      ? `${week.logged.length} of 7 days logged. Average ${week.average.kcal} kcal, ${week.average.protein} g protein, ${week.average.fibre} g fibre, about ₹${week.average.cost} a day.`
      : 'No meals logged in the last 7 days, so I will plan from the profile alone.',
    status: week.average ? 'ok' : 'warn',
  })

  const insights = findPatterns(week, a)
  const flagged = insights.filter((i) => i.band !== 'good')
  trace.push({
    tool: 'detect_patterns',
    thought: 'Compare the week against targets and ICMR-NIN guidance to find what matters most.',
    observation: flagged.length ? `Found ${flagged.length} thing${flagged.length > 1 ? 's' : ''} to work on: ${flagged.map((i) => i.title.toLowerCase()).join('; ')}.` : 'Nothing major to fix this week.',
    status: flagged.some((i) => i.band === 'high') ? 'warn' : 'ok',
  })

  const swaps = findSwaps(week, p)
  trace.push({
    tool: 'suggest_swaps',
    thought: 'Small swaps of foods already being eaten beat a brand-new diet nobody sticks to.',
    observation: swaps.length
      ? swaps.map((s) => `${s.from.name} → ${s.to.map((t) => t.food.name).join(' + ')} (${s.kcalPerWeek} kcal/week)`).join('; ')
      : 'No high-impact swaps found in the logged foods.',
    status: 'ok',
  })

  // Draft the week.
  const rand = rng(`${isoDate(today)}|${p.region}|${p.diet}|${p.budget}`)
  const usedCount = new Map<string, number>()
  let yesterday = new Set<string>()
  const plan: PlanDay[] = []
  const riskHigh = a.idrsBand !== 'good' || insights.some((i) => i.id === 'high-gi')
  for (let d = 1; d <= 7; d++) {
    const date = new Date(today)
    date.setDate(date.getDate() + d)
    const meals: PlannedMeal[] = []
    const todays = new Set<string>()
    for (const meal of MEALS) {
      const kcal = tg.kcal * SLOT_SHARE[meal]
      const ctx: ScoreCtx = { profile: p, slotBudget: p.budget * SLOT_SHARE[meal], riskHigh, usedCount, yesterday, rand }
      const best = TEMPLATES.filter((t) => t.meal === meal)
        .map((t) => ({ t, s: scoreTemplate(t, ctx) }))
        .filter((x) => x.s > -Infinity)
        .sort((x, y) => y.s - x.s)[0]
      if (!best) continue
      usedCount.set(best.t.id, (usedCount.get(best.t.id) ?? 0) + 1)
      todays.add(best.t.id)
      meals.push(planMeal(best.t, meal, kcal))
    }
    yesterday = todays
    plan.push({ date: isoDate(date), label: DAY_LABEL[date.getDay()], meals, totals: dayTotals(meals), revisions: [] })
  }
  trace.push({
    tool: 'plan_week',
    thought: `Draft 7 days of ${p.region} Indian ${p.diet === 'veg' ? 'vegetarian' : p.diet === 'egg' ? 'eggetarian' : 'mixed'} meals, scaling rice, roti or idli to hit each meal's share of ${tg.kcal} kcal${riskHigh ? ' and favouring low-GI options' : ''}.`,
    observation: `Drafted ${plan.reduce((s, d) => s + d.meals.length, 0)} meals from ${usedCount.size} different recipes.`,
    status: 'ok',
  })

  // Self-check: verify each day and repair misses.
  let fixes = 0
  for (const day of plan) {
    day.revisions = verifyDay(day, tg, p)
    fixes += day.revisions.length
  }
  const misses = plan.filter((d) => d.totals.protein < tg.protein * 0.9 || Math.abs(d.totals.kcal - tg.kcal) > tg.kcal * 0.12)
  trace.push({
    tool: 'verify_plan',
    thought: 'Check every drafted day against the targets instead of trusting the draft.',
    observation: fixes
      ? `Repaired ${fixes} issue${fixes > 1 ? 's' : ''} across ${plan.filter((d) => d.revisions.length).length} days. ${misses.length ? `${misses.length} day(s) still slightly off target.` : 'All 7 days now within range.'}`
      : 'All 7 days were already within range.',
    status: fixes ? 'fix' : 'ok',
  })

  const weekCost = plan.reduce((s, d) => s + d.totals.cost, 0)
  const weekBudget = p.budget * 7
  trace.push({
    tool: 'check_budget',
    thought: `Make sure the plan is affordable at ₹${p.budget} a day.`,
    observation:
      weekCost <= weekBudget
        ? `About ₹${weekCost} for the week, within the ₹${weekBudget} budget.`
        : `About ₹${weekCost} for the week, ₹${weekCost - weekBudget} over. Lower the share of paneer or meat dishes, or raise the budget in your profile.`,
    status: weekCost <= weekBudget ? 'ok' : 'warn',
  })

  const nudges = buildNudges(p, a, insights)
  trace.push({
    tool: 'set_nudges',
    thought: 'Food is half of it. Pick the few habits that will help this person most.',
    observation: nudges.map((x) => x.title).join('; ') + '.',
    status: 'ok',
  })

  return {
    assessment: a,
    trace,
    insights,
    swaps,
    plan,
    nudges,
    week: { daysLogged: week.logged.length, average: week.average },
    budget: { weekCost, weekBudget },
  }
}

/** What to eat next today, given what is already logged. */
export function suggestNext(p: Profile, todays: LogEntry[], meal: Meal, count = 3): PlannedMeal[] {
  const a = assess(p)
  const eaten = totals(todays)
  const remainingSlots = MEALS.slice(MEALS.indexOf(meal))
  const share = SLOT_SHARE[meal] / remainingSlots.reduce((s, m) => s + SLOT_SHARE[m], 0)
  const kcal = Math.max(150, (a.targets.kcal - eaten.kcal) * share)
  const rand = rng(`${meal}|${todays.length}`)
  const ctx: ScoreCtx = {
    profile: p,
    slotBudget: p.budget * SLOT_SHARE[meal],
    riskHigh: a.idrsBand !== 'good',
    usedCount: new Map(),
    yesterday: new Set(),
    rand,
  }
  return TEMPLATES.filter((t) => t.meal === meal)
    .map((t) => ({ t, s: scoreTemplate(t, ctx) }))
    .filter((x) => x.s > -Infinity)
    .sort((x, y) => y.s - x.s)
    .slice(0, count)
    .map(({ t }) => planMeal(t, meal, kcal))
}
