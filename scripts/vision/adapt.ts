/* Few-shot adaptation of dish vectors from labelled photos; see fewshot.ts. */
import { FOODS } from '../../src/data/foods'
import type { Entry } from './lib'
import { normalize } from './models'

/** Which dish (or dishes) a labelled dataset photo teaches. */
export const TEACHES: Record<string, string[]> = {
  butter_naan: ['naan'], naan: ['naan'], chai: ['chai'], chapati: ['roti'],
  chole_bhature: ['bhatura'], cholebhature: ['bhatura'], dal_makhani: ['dal-makhani'], dal: ['dal'],
  dhokla: ['dhokla'], idli: ['idli'], jalebi: ['jalebi'], masala_dosa: ['masala-dosa'], dosa: ['dosa'],
  momos: ['veg-momos', 'chicken-momos'], paani_puri: ['pani-puri'], panipuri: ['pani-puri'],
  pakode: ['pakora'], pakora: ['pakora'], pav_bhaji: ['pav-bhaji'], pavbhaji: ['pav-bhaji'],
  samosa: ['samosa'], kadai_paneer: ['paneer-butter-masala'], biryani: ['veg-biryani', 'chicken-biryani'],
  vadapav: ['vada-pav'],
  // 80-class Indian food set (pri12354/indian_food_images)
  aloo_gobi: ['aloo-gobi'], aloo_matar: ['aloo-sabzi'], aloo_methi: ['aloo-sabzi'], dum_aloo: ['aloo-sabzi'],
  bhatura: ['bhatura'], bhindi_masala: ['bhindi'], butter_chicken: ['butter-chicken'],
  chicken_tikka_masala: ['butter-chicken'], chicken_razala: ['chicken-curry'], chana_masala: ['chole'],
  chicken_tikka: ['tandoori-chicken'], dal_tadka: ['dal'], gajar_ka_halwa: ['gajar-halwa'], gulab_jamun: ['gulab-jamun'],
  imarti: ['jalebi'], kachori: ['kachori'], paneer_butter_masala: ['paneer-butter-masala'], palak_paneer: ['palak-paneer'],
  kadhi_pakoda: ['kadhi'], lassi: ['lassi'], maach_jhol: ['fish-curry'], navrattan_korma: ['mixed-veg'],
  phirni: ['kheer'], doodhpak: ['kheer'], poha: ['poha'], rasgulla: ['rasgulla'], bandar_laddu: ['ladoo'],
}

export const idx = new Map(FOODS.map((f, i) => [f.id, i]))

function mean(vs: Float32Array[]): Float32Array {
  const m = new Float32Array(vs[0].length)
  for (const v of vs) v.forEach((x, j) => (m[j] += x / vs.length))
  return m
}

export interface Adapted {
  vecs: Float32Array[]
  /** Subtracted from each dish's similarity; zero for dishes without examples. */
  bias: number[]
}

export const unadapted = (T: Float32Array[]): Adapted => ({ vecs: T, bias: T.map(() => 0) })

const dotp = (a: Float32Array, b: Float32Array) => {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

/**
 * Adapt the text vectors of the dishes in `examples` (food index → image vectors).
 * With `calibrate`, each adapted dish also gets a bias equal to how much its
 * similarity to photos of *other* dishes went up, so it gains on its own
 * photos without pulling in everyone else's.
 */
export function adapt(T: Float32Array[], examples: Map<number, Float32Array[]>, lambda: number, calibrate = true): Adapted {
  if (!examples.size || lambda === 0) return unadapted(T)
  const cents = new Map([...examples].map(([c, vs]) => [c, normalize(mean(vs))]))
  const g = mean([...cents.keys()].map((c) => T[c].map((x, j) => x - cents.get(c)![j])))
  const vecs = T.map((t, c) => {
    const mu = cents.get(c)
    if (!mu) return t
    const shifted = normalize(mu.map((x, j) => x + g[j]))
    return normalize(t.map((x, j) => (1 - lambda) * x + lambda * shifted[j]))
  })
  const bias = T.map((t, c) => {
    if (!calibrate || !cents.has(c)) return 0
    const others = [...examples].filter(([k]) => k !== c).flatMap(([, vs]) => vs)
    if (!others.length) return 0
    return others.reduce((s, x) => s + dotp(x, vecs[c]) - dotp(x, t), 0) / others.length
  })
  return { vecs, bias }
}

export function group(entries: Entry[], vecs: Float32Array[]) {
  const by = new Map<number, Float32Array[]>()
  entries.forEach((e, i) => {
    for (const id of TEACHES[e.label] ?? []) {
      const c = idx.get(id)!
      if (!by.has(c)) by.set(c, [])
      by.get(c)!.push(vecs[i])
    }
  })
  return by
}

