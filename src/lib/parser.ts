import { FOODS, FOOD_BY_ID } from '../data/foods'

export interface ParsedItem {
  foodId: string
  qty: number
  /** The words in the input that produced this match. */
  text: string
  /** 0 to 1. Exact name or alias hits score 1, fuzzy matches score lower. */
  confidence: number
}

export interface ParseResult {
  items: ParsedItem[]
  unmatched: string[]
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  half: 0.5, quarter: 0.25, couple: 2, few: 3,
  // Hindi
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, aadha: 0.5, adha: 0.5, dedh: 1.5, dhai: 2.5,
  // Tamil
  oru: 1, rendu: 2, irandu: 2, moonu: 3, naalu: 4, anju: 5, arai: 0.5,
}

const UNITS = new Set([
  'cup', 'cups', 'katori', 'katoris', 'bowl', 'bowls', 'plate', 'plates', 'piece', 'pieces', 'pc', 'pcs',
  'glass', 'glasses', 'tbsp', 'tsp', 'spoon', 'spoons', 'serving', 'servings', 'small', 'medium', 'large',
  'big', 'of', 'nos', 'no', 'packet', 'pack', 'can', 'slice', 'slices', 'handful', 'ladle', 'ladles',
])

const GRAM_UNITS = new Set(['g', 'gm', 'gms', 'gram', 'grams', 'ml'])

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/½/g, ' 0.5 ')
    .replace(/¼/g, ' 0.25 ')
    .replace(/(\d)\s*\/\s*(\d)/g, (_, a, b) => ` ${Number(a) / Number(b)} `)
    .replace(/(\d)(g|gm|gms|ml)\b/g, '$1 $2')
    .replace(/[^a-z0-9.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Strip a trailing plural "s" so "idlis" and "rotis" meet "idli" and "roti". */
const singular = (w: string) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)

const keyOf = (s: string) => normalize(s).split(' ').map(singular).join(' ')

interface Key {
  key: string
  foodId: string
  words: number
}

const KEYS: Key[] = FOODS.flatMap((f) =>
  [f.name, ...f.name.split('/'), f.id.replace(/-/g, ' '), ...f.aliases].map((s) => {
    const key = keyOf(s)
    return { key, foodId: f.id, words: key.split(' ').length }
  }),
)
  .filter((k) => k.key.length > 1)
  // Longest phrases first, so "curd rice" wins over "curd" and "rice".
  .sort((a, b) => b.words - a.words || b.key.length - a.key.length)

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>()
  const t = ` ${s} `
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2)
    m.set(g, (m.get(g) ?? 0) + 1)
  }
  return m
}

/** Sørensen-Dice similarity on character bigrams, tolerant of small typos. */
export function dice(a: string, b: string): number {
  if (a === b) return 1
  const A = bigrams(a)
  const B = bigrams(b)
  let overlap = 0
  let total = 0
  for (const [g, n] of A) {
    overlap += Math.min(n, B.get(g) ?? 0)
    total += n
  }
  for (const n of B.values()) total += n
  return total ? (2 * overlap) / total : 0
}

function readQty(tokens: string[]): { qty: number | null; grams: number | null } {
  let qty: number | null = null
  let grams: number | null = null
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    const n = /^\d+(\.\d+)?$/.test(t) ? Number(t) : NUMBER_WORDS[t]
    if (n === undefined) continue
    if (GRAM_UNITS.has(tokens[i + 1] ?? '')) grams = n
    else if (qty === null) qty = n
    else if (t !== 'a' && t !== 'an') qty *= n // "half a cup" or "2 half plates"
  }
  return { qty, grams }
}

const isFiller = (w: string) =>
  w in NUMBER_WORDS || UNITS.has(w) || GRAM_UNITS.has(w) || /^\d+(\.\d+)?$/.test(w) ||
  ['had', 'ate', 'some', 'little', 'i', 'my', 'for', 'the', 'breakfast', 'lunch', 'dinner', 'snack', 'today', 'extra'].includes(w)

function matchChunk(chunk: string): { items: ParsedItem[]; leftover: string } {
  const tokens = normalize(chunk).split(' ').filter(Boolean)
  const words = tokens.map(singular)
  const used = new Array(words.length).fill(false)
  const hits: { foodId: string; start: number; end: number; confidence: number }[] = []

  // 1. Whole-word phrase hits, longest first.
  for (const k of KEYS) {
    const kw = k.key.split(' ')
    for (let i = 0; i + kw.length <= words.length; i++) {
      if (used.slice(i, i + kw.length).some(Boolean)) continue
      if (kw.every((w, j) => words[i + j] === w)) {
        hits.push({ foodId: k.foodId, start: i, end: i + kw.length, confidence: 1 })
        for (let j = i; j < i + kw.length; j++) used[j] = true
      }
    }
  }

  // 2. Fuzzy match on whatever content words remain, to catch typos.
  const rest = words.map((w, i) => (used[i] || isFiller(w) ? '' : w))
  const restText = rest.filter(Boolean).join(' ')
  if (restText.length >= 3) {
    let best: { foodId: string; score: number } | null = null
    for (const k of KEYS) {
      const score = dice(restText, k.key)
      if (!best || score > best.score) best = { foodId: k.foodId, score }
    }
    if (best && best.score >= 0.55) {
      const start = rest.findIndex(Boolean)
      hits.push({ foodId: best.foodId, start, end: start + 1, confidence: Math.round(best.score * 100) / 100 })
      rest.fill('')
    }
  }

  hits.sort((a, b) => a.start - b.start)

  // Quantities: each hit takes the numbers between the previous hit and itself.
  const items: ParsedItem[] = hits.map((h, idx) => {
    const from = idx === 0 ? 0 : hits[idx - 1].end
    const { qty, grams } = readQty(tokens.slice(from, h.start))
    const f = FOOD_BY_ID[h.foodId]
    let q = qty ?? 1
    if (grams !== null) q = grams / f.grams
    return {
      foodId: h.foodId,
      qty: Math.max(0.25, Math.round(q * 4) / 4),
      text: tokens.slice(from, h.end).join(' '),
      confidence: h.confidence,
    }
  })

  // Merge duplicates such as "2 roti and 1 more roti".
  const merged = new Map<string, ParsedItem>()
  for (const it of items) {
    const prev = merged.get(it.foodId)
    if (prev) prev.qty += it.qty
    else merged.set(it.foodId, { ...it })
  }

  return { items: [...merged.values()], leftover: rest.filter(Boolean).join(' ') }
}

/** Turn free text such as "2 rotis, dal and half cup rice" into food items. */
export function parseMeal(input: string): ParseResult {
  const chunks = input
    .split(/,|\n|;|\+|&|\band\b|\bwith\b|\bplus\b|\baur\b|\bum\b/i)
    .map((c) => c.trim())
    .filter(Boolean)
  const items: ParsedItem[] = []
  const unmatched: string[] = []
  for (const c of chunks) {
    const r = matchChunk(c)
    items.push(...r.items)
    if (r.leftover && r.items.length === 0) unmatched.push(c)
  }
  return { items, unmatched }
}
