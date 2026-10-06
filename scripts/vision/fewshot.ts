/*
 * Few-shot adaptation of the zero-shot dish classifier, then (with --write)
 * export the class vectors the app ships.
 *
 *   npx vite-node scripts/vision/fewshot.ts -- --manifest <dir>/manifest.json --model mobileclip-s2 [--tta] [--write]
 *
 * Method: for every dish that has example photos, move its text embedding
 * towards the centroid of those photos' image embeddings:
 *
 *   t'_c = normalize((1 - λ) · t_c + λ · normalize(μ_c + g))
 *
 * μ_c is the normalised mean image embedding of the dish's photos and g is the
 * modality gap (mean text vector minus mean image centroid over those
 * dishes), which shifts the image centroid into the text cone, so adapted
 * and unadapted dishes stay on the same similarity scale. The result is
 * still one vector per dish, so the app's inference cost does not change.
 *
 * λ is chosen on held-out training photos with a class split: adapt half of
 * the dishes and measure accuracy on both halves, so a λ that helps adapted
 * dishes by stealing predictions from the others is not rewarded. The test
 * and wiki photos are only scored, never used to fit or choose anything.
 */
import { writeFileSync } from 'node:fs'
import { FOODS } from '../../src/data/foods'
import { TEACHES, adapt, group, idx, unadapted, type Adapted } from './adapt'
import { accuracy, arg, foodTextEmbeddings, loadManifest, type Entry } from './lib'
import { MODELS, dot, embedImages, normalize } from './models'

const pct = (x: number) => `${(x * 100).toFixed(1)}%`

const scoreWith = (A: Adapted) => (imgs: Float32Array[]) => imgs.map((v) => A.vecs.map((t, c) => dot(v, t) - A.bias[c]))

async function main() {
  const model = arg('model', 'mobileclip-s2')
  const tta = process.argv.includes('--tta')
  const entries = loadManifest(arg('manifest'))
  const train = entries.filter((e) => e.split === 'train' && TEACHES[e.label])
  const test = entries.filter((e) => e.split === 'test')
  const wiki = entries.filter((e) => e.split === 'wiki')

  const embed = async (es: Entry[]) => {
    const a = (await embedImages(model, es.map((e) => e.path), 'orig'))!
    if (!tta) return a
    const b = (await embedImages(model, es.map((e) => e.path), 'flip'))!
    return a.map((v, i) => normalize(v.map((x, j) => x + b[i][j])))
  }
  const [trainV, testV, wikiV] = [await embed(train), await embed(test), await embed(wiki)]
  const T = await foodTextEmbeddings(model)

  // Fit/validation split inside the training photos: every 4th photo of each label validates.
  const seen = new Map<string, number>()
  const isVal = train.map((e) => {
    const k = `${e.source}/${e.label}`
    const n = seen.get(k) ?? 0
    seen.set(k, n + 1)
    return n % 4 === 3
  })
  const fitE = train.filter((_, i) => !isVal[i]), fitV = trainV.filter((_, i) => !isVal[i])
  const valE = train.filter((_, i) => isVal[i]), valV = trainV.filter((_, i) => isVal[i])
  const fitGroups = group(fitE, fitV)
  const classes = [...fitGroups.keys()].sort((a, b) => a - b)
  const halves = [classes.filter((_, i) => i % 2 === 0), classes.filter((_, i) => i % 2 === 1)]
  const teachesAny = (e: Entry, set: number[]) => (TEACHES[e.label] ?? []).some((id) => set.includes(idx.get(id)!))

  console.log(`${model}${tta ? ' + flip TTA' : ''}: ${classes.length} dishes with examples, ${fitE.length} fit / ${valE.length} validation photos`)
  let best = { lambda: 0, calibrate: false, score: -1 }
  for (const calibrate of [false, true])
  for (const lambda of [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5]) {
    let total = 0, sumA = 0, sumB = 0
    for (const [adapted, held] of [halves, [halves[1], halves[0]]]) {
      const Tl = adapt(T, new Map([...fitGroups].filter(([c]) => adapted.includes(c))), lambda, calibrate)
      const onA = valE.map((e, i) => [e, valV[i]] as const).filter(([e]) => teachesAny(e, adapted))
      const onB = valE.map((e, i) => [e, valV[i]] as const).filter(([e]) => teachesAny(e, held))
      const accA = accuracy(scoreWith(Tl)(onA.map(([, v]) => v)), onA.map(([e]) => e)).top1
      const accB = accuracy(scoreWith(Tl)(onB.map(([, v]) => v)), onB.map(([e]) => e)).top1
      total += (accA + accB) / 2
      sumA += accA / 2
      sumB += accB / 2
    }
    const score = total / 2
    console.log(`  ${calibrate ? 'calibrated' : 'plain     '} λ=${lambda.toFixed(2)}  validation ${pct(score)}  (adapted dishes ${pct(sumA)}, untouched dishes ${pct(sumB)})`)
    if (score > best.score + 0.002) best = { lambda, calibrate, score }
  }

  const final = adapt(T, group(train, trainV), best.lambda, best.calibrate)
  const report = (name: string, Tx: Adapted) => {
    const a = accuracy(scoreWith(Tx)(testV), test)
    const w = accuracy(scoreWith(Tx)(wikiV), wiki)
    console.log(`${name.padEnd(28)} test top1 ${pct(a.top1)} top3 ${pct(a.top3)} (n=${a.n})   wiki top1 ${pct(w.top1)} top3 ${pct(w.top3)} (n=${w.n})`)
    return { test: a, wiki: w }
  }
  const zero = report('zero-shot', unadapted(T))
  const few = report(`few-shot λ=${best.lambda}${best.calibrate ? ' calibrated' : ''}`, final)

  if (process.argv.includes('--write')) {
    const d = final.vecs[0].length
    const bytes: number[] = []
    const scales: number[] = []
    for (const v of final.vecs) {
      const max = Math.max(...v.map(Math.abs))
      const scale = max / 127
      for (let j = 0; j < d; j++) bytes.push(Math.round(v[j] / scale) & 0xff)
      scales.push(Number(scale.toPrecision(6)))
    }
    const spec = MODELS[model]
    const out = {
      model: spec.id,
      kind: spec.kind,
      dtype: spec.dtype,
      tta,
      dim: d,
      method: `prompt-ensembled text embeddings, few-shot adapted (λ=${best.lambda}${best.calibrate ? ', bias-calibrated' : ''}) on ${train.length} labelled photos`,
      bias: final.bias.map((b) => Number(b.toFixed(5))),
      eval: { zeroShot: zero, fewShot: few },
      ids: FOODS.map((f) => f.id),
      scales,
      data: Buffer.from(bytes).toString('base64'),
    }
    writeFileSync('src/vision/labels.json', JSON.stringify(out))
    console.log(`wrote src/vision/labels.json (${FOODS.length} dishes, ${d}-d)`)
  }
}

main()
