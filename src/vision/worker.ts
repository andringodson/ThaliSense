/// <reference lib="webworker" />
import {
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
  SiglipVisionModel,
  env,
  type PreTrainedModel,
  type Processor,
} from '@huggingface/transformers'
import labels from './labels.json'

/*
 * Dish recognition, entirely in the browser. A vision-language encoder turns
 * the photo into a vector, which is compared with one vector per dish. Those
 * dish vectors were computed ahead of time from text prompts and adapted with
 * real labelled photos (scripts/vision/fewshot.ts). No photo leaves the device.
 *
 * Results come in two passes: the whole photo first (fast), then five regions
 * of the plate, so a thali with several katoris yields several dishes.
 */

env.allowLocalModels = false

export type Score = { foodId: string; p: number }
export type VisionRequest = { type: 'classify'; id: number; image: Blob; thali: boolean } | { type: 'warmup' }
export type VisionResponse =
  | { type: 'progress'; loaded: number; total: number; file: string }
  | { type: 'ready'; device: string }
  | { type: 'result'; id: number; scores: Score[]; ms: number }
  | { type: 'regions'; id: number; found: Score[]; ms: number }
  | { type: 'error'; id?: number; message: string }

const post = (m: VisionResponse) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m)

const { dim, ids, scales } = labels
const raw = Uint8Array.from(atob(labels.data), (c) => c.charCodeAt(0))
const dishVecs = ids.map((_, i) => {
  const v = new Float32Array(dim)
  for (let j = 0; j < dim; j++) v[j] = ((raw[i * dim + j] << 24) >> 24) * scales[i]
  return v
})

const files = new Map<string, { loaded: number; total: number }>()
const onProgress = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
  if (p.status !== 'progress' || !p.file) return
  files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 })
  let loaded = 0, total = 0
  for (const f of files.values()) {
    loaded += f.loaded
    total += f.total
  }
  post({ type: 'progress', loaded, total, file: p.file })
}

type Loaded = { processor: Processor; model: PreTrainedModel; device: string }
let loading: Promise<Loaded> | null = null

async function hasWebGPU() {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu
    return !!(gpu && (await gpu.requestAdapter()))
  } catch {
    return false
  }
}

function load(): Promise<Loaded> {
  loading ??= (async () => {
    const Model = labels.kind === 'siglip' ? SiglipVisionModel : CLIPVisionModelWithProjection
    const processor = await AutoProcessor.from_pretrained(labels.model)
    // WebGPU runs the encoder in tens of milliseconds where available;
    // otherwise WASM, multi-threaded when the page is cross-origin isolated.
    if (await hasWebGPU()) {
      try {
        const model = await Model.from_pretrained(labels.model, { device: 'webgpu', dtype: 'fp16', progress_callback: onProgress })
        return { processor, model, device: 'webgpu' }
      } catch {
        // Fall back to WASM below.
      }
    }
    const model = await Model.from_pretrained(labels.model, { device: 'wasm', dtype: labels.dtype as 'q8' | 'fp16', progress_callback: onProgress })
    return { processor, model, device: self.crossOriginIsolated ? 'wasm-threads' : 'wasm' }
  })()
  return loading
}

function mirror(img: RawImage): RawImage {
  const { width: w, height: h, channels: c, data } = img
  const out = new Uint8ClampedArray(data.length)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let k = 0; k < c; k++) out[(y * w + x) * c + k] = data[(y * w + (w - 1 - x)) * c + k]
  return new RawImage(out, w, h, c)
}

async function embed({ processor, model }: Loaded, img: RawImage): Promise<Float32Array> {
  const out = await model(await processor(img))
  const t = labels.kind === 'siglip' ? out.pooler_output : out.image_embeds
  const v = t.data as Float32Array
  let n = 0
  for (const x of v) n += x * x
  n = Math.sqrt(n) || 1
  return v.map((x) => x / n)
}

/** Softmax over dishes of the scaled cosine similarity. */
function rank(v: Float32Array): Score[] {
  const logits = dishVecs.map((t, c) => {
    let s = 0
    for (let j = 0; j < dim; j++) s += t[j] * v[j]
    return 100 * (s - (labels.bias?.[c] ?? 0))
  })
  const max = Math.max(...logits)
  const exps = logits.map((l) => Math.exp(l - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return ids.map((foodId, i) => ({ foodId, p: exps[i] / sum })).sort((a, b) => b.p - a.p)
}

/** Five overlapping regions: four corners and the centre, each 60% of the photo. */
async function regions(img: RawImage): Promise<RawImage[]> {
  const w = Math.round(img.width * 0.6), h = Math.round(img.height * 0.6)
  const xs = [0, img.width - w, Math.round((img.width - w) / 2)]
  const ys = [0, img.height - h, Math.round((img.height - h) / 2)]
  const boxes: [number, number][] = [[xs[0], ys[0]], [xs[1], ys[0]], [xs[0], ys[1]], [xs[1], ys[1]], [xs[2], ys[2]]]
  return Promise.all(boxes.map(([x, y]) => img.crop([x, y, x + w - 1, y + h - 1])))
}

self.onmessage = async (e: MessageEvent<VisionRequest>) => {
  const msg = e.data
  try {
    const m = await load()
    post({ type: 'ready', device: m.device })
    if (msg.type === 'warmup') return
    const t0 = performance.now()
    const image = (await RawImage.fromBlob(msg.image)).rgb()
    let v = await embed(m, image)
    if (labels.tta) {
      const f = await embed(m, mirror(image))
      v = v.map((x, j) => x + f[j])
    }
    const full = rank(v)
    post({ type: 'result', id: msg.id, scores: full.slice(0, 8), ms: Math.round(performance.now() - t0) })
    if (!msg.thali) return

    // Second pass: anything a region is confident about that the whole photo missed.
    const t1 = performance.now()
    const top = new Set(full.slice(0, 3).map((s) => s.foodId))
    const found = new Map<string, number>()
    for (const r of await regions(image)) {
      const best = rank(await embed(m, r))[0]
      if (best.p >= 0.3 && !top.has(best.foodId)) found.set(best.foodId, Math.max(best.p, found.get(best.foodId) ?? 0))
    }
    post({
      type: 'regions',
      id: msg.id,
      found: [...found].map(([foodId, p]) => ({ foodId, p })).sort((a, b) => b.p - a.p),
      ms: Math.round(performance.now() - t1),
    })
  } catch (err) {
    post({ type: 'error', id: msg.type === 'classify' ? msg.id : undefined, message: err instanceof Error ? err.message : String(err) })
  }
}
