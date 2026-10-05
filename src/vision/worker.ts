/// <reference lib="webworker" />
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } from '@huggingface/transformers'
import labels from './labels.json'

/*
 * Dish recognition, entirely in the browser. The CLIP vision encoder turns the
 * photo into a 512-d vector; we compare it with text vectors for every dish
 * that were computed ahead of time (scripts/embed-labels.ts). No photo ever
 * leaves the device.
 */

env.allowLocalModels = false

export type VisionRequest = { type: 'classify'; id: number; image: Blob } | { type: 'warmup' }
export type VisionResponse =
  | { type: 'progress'; loaded: number; total: number; file: string }
  | { type: 'ready' }
  | { type: 'result'; id: number; scores: { foodId: string; p: number }[]; ms: number }
  | { type: 'error'; id?: number; message: string }

const post = (m: VisionResponse) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m)

const { dim, ids, scales } = labels
const raw = Uint8Array.from(atob(labels.data), (c) => c.charCodeAt(0))
const textEmb = ids.map((_, i) => {
  const v = new Float32Array(dim)
  for (let j = 0; j < dim; j++) v[j] = ((raw[i * dim + j] << 24) >> 24) * scales[i]
  return v
})

const files = new Map<string, { loaded: number; total: number }>()

let loading: Promise<[Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>, CLIPVisionModelWithProjection]> | null = null
function load() {
  loading ??= Promise.all([
    AutoProcessor.from_pretrained(labels.model),
    CLIPVisionModelWithProjection.from_pretrained(labels.model, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status !== 'progress' || !p.file) return
        files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 })
        let loaded = 0, total = 0
        for (const f of files.values()) {
          loaded += f.loaded
          total += f.total
        }
        post({ type: 'progress', loaded, total, file: p.file })
      },
    }) as Promise<CLIPVisionModelWithProjection>,
  ])
  return loading
}

self.onmessage = async (e: MessageEvent<VisionRequest>) => {
  const msg = e.data
  try {
    const [processor, model] = await load()
    if (msg.type === 'warmup') return post({ type: 'ready' })
    post({ type: 'ready' })
    const t0 = performance.now()
    const image = await RawImage.fromBlob(msg.image)
    const { image_embeds } = await model(await processor(image))
    const v = image_embeds.data as Float32Array
    let norm = 0
    for (const x of v) norm += x * x
    norm = Math.sqrt(norm)
    // CLIP's learned logit scale is 100; softmax over cosine similarities.
    const logits = textEmb.map((t) => {
      let s = 0
      for (let j = 0; j < dim; j++) s += t[j] * v[j]
      return (100 * s) / norm
    })
    const max = Math.max(...logits)
    const exps = logits.map((l) => Math.exp(l - max))
    const sum = exps.reduce((a, b) => a + b, 0)
    const scores = ids
      .map((foodId, i) => ({ foodId, p: exps[i] / sum }))
      .sort((a, b) => b.p - a.p)
      .slice(0, 8)
    post({ type: 'result', id: msg.id, scores, ms: Math.round(performance.now() - t0) })
  } catch (err) {
    post({ type: 'error', id: msg.type === 'classify' ? msg.id : undefined, message: err instanceof Error ? err.message : String(err) })
  }
}
