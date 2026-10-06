/*
 * Multi-dish ("whole thali") evaluation of the vectors the app ships.
 *
 *   npx vite-node scripts/vision/thali.ts -- --thali <dir>/thali.json
 *
 * Each test plate holds four different dishes. We compare suggesting the
 * whole photo's top 4 with the app's two-pass logic (top 4 plus dishes that
 * one of five plate regions is confident about), at several confidence
 * thresholds, and report how many of the four dishes end up suggested.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import labels from '../../src/vision/labels.json'
import { arg } from './lib'
import { MODELS, dot, embedImages, type View } from './models'

type Plate = { path: string; dishes: { label: string; accept: string[] }[] }

const file = arg('thali')
const plates = (JSON.parse(readFileSync(file, 'utf8')) as Plate[]).map((p) => ({ ...p, path: join(dirname(file), p.path) }))
const model = Object.entries(MODELS).find(([, s]) => s.id === labels.model)![0]

const raw = Buffer.from(labels.data, 'base64')
const dishes = labels.ids.map((_, i) => Float32Array.from({ length: labels.dim }, (_, j) => ((raw[i * labels.dim + j] << 24) >> 24) * labels.scales[i]))

function rank(v: Float32Array) {
  const logits = dishes.map((t, c) => 100 * (dot(v, t) - ((labels as { bias?: number[] }).bias?.[c] ?? 0)))
  const max = Math.max(...logits)
  const e = logits.map((l) => Math.exp(l - max))
  const sum = e.reduce((a, b) => a + b, 0)
  return labels.ids.map((id, i) => ({ id, p: e[i] / sum })).sort((a, b) => b.p - a.p)
}

const paths = plates.map((p) => p.path)
const full = (await embedImages(model, paths, 'orig'))!
const regions = await Promise.all((['r0', 'r1', 'r2', 'r3', 'r4'] as View[]).map(async (v) => (await embedImages(model, paths, v))!))

function score(suggest: (i: number) => string[]) {
  let found = 0, total = 0, shown = 0, right = 0
  plates.forEach((plate, i) => {
    const s = suggest(i)
    shown += s.length
    right += s.filter((id) => plate.dishes.some((d) => d.accept.includes(id))).length
    for (const d of plate.dishes) {
      total++
      if (s.some((id) => d.accept.includes(id))) found++
    }
  })
  return `dishes found ${((found / total) * 100).toFixed(1)}%  · ${(shown / plates.length).toFixed(1)} suggestions per plate, ${((right / shown) * 100).toFixed(0)}% of them correct`
}

console.log(`${plates.length} plates × 4 dishes, ${model}`)
console.log(`whole photo, top 4            ${score((i) => rank(full[i]).slice(0, 4).map((s) => s.id))}`)
console.log(`whole photo, top 8            ${score((i) => rank(full[i]).slice(0, 8).map((s) => s.id))}`)
for (const th of [0.2, 0.3, 0.4, 0.5]) {
  console.log(
    `top 4 + regions (p ≥ ${th.toFixed(1)})    ` +
      score((i) => {
        const top = rank(full[i]).slice(0, 4).map((s) => s.id)
        const extra = new Set<string>()
        for (const r of regions) {
          const best = rank(r[i])[0]
          if (best.p >= th && !top.slice(0, 3).includes(best.id)) extra.add(best.id)
        }
        return [...new Set([...top, ...extra])]
      }),
  )
}
