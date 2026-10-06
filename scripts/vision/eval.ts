/*
 * Benchmark dish recognition on labelled photos.
 *
 *   npx vite-node scripts/vision/eval.ts -- --manifest <dir>/manifest.json --models clip-b32,mobileclip-s2
 *
 * The manifest lists photos as { path, split, source, label, accept[] }, where
 * `accept` holds every food id that counts as correct (e.g. any biryani for a
 * photo labelled "biryani"). Splits: `train` (few-shot examples only),
 * `test` and `wiki` (never used for anything but scoring).
 */
import { FOODS } from '../../src/data/foods'
import { accuracy, arg, foodTextEmbeddings, loadManifest } from './lib'
import { MODELS, dot, embedImages } from './models'

const pct = (x: number) => `${(x * 100).toFixed(1)}%`

async function main() {
  const entries = loadManifest(arg('manifest'))
  const models = arg('models', Object.keys(MODELS).join(',')).split(',')
  const test = entries.filter((e) => e.split === 'test')
  const wiki = entries.filter((e) => e.split === 'wiki')
  console.log(`test photos ${test.length} · wiki photos ${wiki.length} · classes ${FOODS.length}`)
  for (const m of models) {
    const t0 = Date.now()
    const T = await foodTextEmbeddings(m)
    const score = (imgs: Float32Array[]) => imgs.map((v) => T.map((t) => dot(v, t)))
    const testImgs = await embedImages(m, test.map((e) => e.path))
    const wikiImgs = wiki.length ? await embedImages(m, wiki.map((e) => e.path)) : []
    const a = accuracy(score(testImgs), test)
    const w = wiki.length ? accuracy(score(wikiImgs), wiki) : null
    console.log(
      `${m.padEnd(14)} ${String(MODELS[m].visionMB).padStart(3)} MB  test top1 ${pct(a.top1)} top3 ${pct(a.top3)}` +
        (w ? `  wiki top1 ${pct(w.top1)} top3 ${pct(w.top3)}` : '') +
        `  (${Math.round((Date.now() - t0) / 1000)} s)`,
    )
  }
}

main()
