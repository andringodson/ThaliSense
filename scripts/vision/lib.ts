/*
 * Shared helpers for the vision scripts: the photo manifest, prompt-ensembled
 * text embeddings per food, and accuracy scoring.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { FOODS } from '../../src/data/foods'
import { LOOKS, prompts } from './looks'
import { normalize, textEncoder } from './models'

export interface Entry {
  path: string
  split: 'train' | 'test' | 'wiki'
  source: string
  label: string
  accept: string[]
}

export const arg = (k: string, d = '') => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : d
}

export function loadManifest(file: string): Entry[] {
  const dir = dirname(file)
  return (JSON.parse(readFileSync(file, 'utf8')) as Entry[]).map((e) => ({ ...e, path: join(dir, e.path) }))
}

/** One prompt-ensembled, normalised text vector per food, in FOODS order. */
export async function foodTextEmbeddings(model: string): Promise<Float32Array[]> {
  const enc = await textEncoder(model)
  const out: Float32Array[] = []
  for (const f of FOODS) {
    const name = f.name.split('/')[0].trim().toLowerCase()
    const vs = await enc(prompts(name, LOOKS[f.id] ?? name))
    const mean = new Float32Array(vs[0].length)
    for (const v of vs) v.forEach((x, j) => (mean[j] += x / vs.length))
    out.push(normalize(mean))
  }
  return out
}

/** Top-1 and top-3 accuracy, given a score row per image. */
export function accuracy(scores: number[][], entries: Entry[]) {
  let t1 = 0, t3 = 0
  scores.forEach((row, i) => {
    const order = row.map((s, c) => [s, c] as const).sort((a, b) => b[0] - a[0]).map(([, c]) => FOODS[c].id)
    const ok = entries[i].accept
    if (ok.includes(order[0])) t1++
    if (order.slice(0, 3).some((id) => ok.includes(id))) t3++
  })
  return { top1: t1 / entries.length, top3: t3 / entries.length, n: entries.length }
}
