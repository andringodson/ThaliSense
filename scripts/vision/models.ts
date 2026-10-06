/*
 * Text and image encoders for every vision-language model we evaluate, with a
 * disk cache so repeated experiments don't re-embed thousands of photos.
 */
import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
  SiglipTextModel,
  SiglipVisionModel,
} from '@huggingface/transformers'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface ModelSpec {
  id: string
  kind: 'clip' | 'siglip'
  /** Pad text to the model's fixed length (MobileCLIP and SigLIP need it). */
  padMax: boolean
  /** Vision encoder precision. int8 breaks MobileCLIP's convolutions, so it ships fp16. */
  dtype: 'q8' | 'fp16'
  /** Size of the vision encoder the browser downloads, in MB. */
  visionMB: number
}

export const MODELS: Record<string, ModelSpec> = {
  'clip-b32': { id: 'Xenova/clip-vit-base-patch32', kind: 'clip', padMax: false, dtype: 'q8', visionMB: 89 },
  'clip-b16': { id: 'Xenova/clip-vit-base-patch16', kind: 'clip', padMax: false, dtype: 'q8', visionMB: 87 },
  'mobileclip-s2': { id: 'Xenova/mobileclip_s2', kind: 'clip', padMax: true, dtype: 'fp16', visionMB: 72 },
  'siglip-b16': { id: 'Xenova/siglip-base-patch16-224', kind: 'siglip', padMax: true, dtype: 'q8', visionMB: 99 },
}

export const CACHE = process.env.VISION_CACHE ?? 'node_modules/.cache/thalisense-vision'

export function normalize(v: Float32Array): Float32Array {
  let n = 0
  for (const x of v) n += x * x
  n = Math.sqrt(n) || 1
  return v.map((x) => x / n)
}

function rows(data: Float32Array, n: number, d: number): Float32Array[] {
  return Array.from({ length: n }, (_, i) => normalize(data.slice(i * d, (i + 1) * d)))
}

export async function textEncoder(name: string) {
  const spec = MODELS[name]
  const tokenizer = await AutoTokenizer.from_pretrained(spec.id)
  const model =
    spec.kind === 'siglip'
      ? await SiglipTextModel.from_pretrained(spec.id, { dtype: 'fp32' })
      : await CLIPTextModelWithProjection.from_pretrained(spec.id, { dtype: 'fp32' })
  return async (texts: string[]): Promise<Float32Array[]> => {
    const inputs = tokenizer(texts, { padding: spec.padMax ? 'max_length' : true, truncation: true })
    const out = await model(inputs)
    const t = spec.kind === 'siglip' ? out.pooler_output : out.text_embeds
    const [n, d] = t.dims as number[]
    return rows(t.data as Float32Array, n, d)
  }
}

/** Mirror an image left to right, for test-time augmentation. */
export function flip(img: RawImage): RawImage {
  const { width: w, height: h, channels: c } = img
  const src = img.data
  const out = new Uint8ClampedArray(src.length)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let k = 0; k < c; k++) out[(y * w + x) * c + k] = src[(y * w + (w - 1 - x)) * c + k]
  return new RawImage(out, w, h, c)
}

/** Keep the central `f` fraction of the image, where the dish usually is. */
export async function centerCrop(img: RawImage, f = 0.8): Promise<RawImage> {
  const cw = Math.round(img.width * f), ch = Math.round(img.height * f)
  const x0 = Math.floor((img.width - cw) / 2), y0 = Math.floor((img.height - ch) / 2)
  return img.crop([x0, y0, x0 + cw - 1, y0 + ch - 1])
}

/** Test-time views: the photo, its mirror, a centre crop, or one of the five plate regions the app scans. */
export type View = 'orig' | 'flip' | 'crop' | 'r0' | 'r1' | 'r2' | 'r3' | 'r4'

/** The same five regions as src/vision/worker.ts: four corners and the centre, each 60% of the photo. */
export async function region(img: RawImage, k: number): Promise<RawImage> {
  const w = Math.round(img.width * 0.6), h = Math.round(img.height * 0.6)
  const xs = [0, img.width - w, Math.round((img.width - w) / 2)]
  const ys = [0, img.height - h, Math.round((img.height - h) / 2)]
  const boxes: [number, number][] = [[xs[0], ys[0]], [xs[1], ys[0]], [xs[0], ys[1]], [xs[1], ys[1]], [xs[2], ys[2]]]
  const [x, y] = boxes[k]
  return img.crop([x, y, x + w - 1, y + h - 1])
}

export async function imageEncoder(name: string) {
  const spec = MODELS[name]
  const processor = await AutoProcessor.from_pretrained(spec.id)
  const model =
    spec.kind === 'siglip'
      ? await SiglipVisionModel.from_pretrained(spec.id, { dtype: spec.dtype })
      : await CLIPVisionModelWithProjection.from_pretrained(spec.id, { dtype: spec.dtype })
  return async (img: RawImage): Promise<Float32Array> => {
    const out = await model(await processor(img))
    const t = spec.kind === 'siglip' ? out.pooler_output : out.image_embeds
    return normalize(t.data as Float32Array)
  }
}

const CHUNK = 200

/** Prepare one image for a test-time-augmentation view. */
export async function viewOf(img: RawImage, view: View): Promise<RawImage> {
  if (view === 'flip') return flip(img)
  if (view === 'crop') return centerCrop(img)
  if (view[0] === 'r') return region(img, Number(view[1]))
  return img
}

/**
 * Embed image files under a view. Vectors are cached on disk in chunks of 200
 * keyed by model, view and paths, so long runs can stop and resume.
 * With `budgetMs`, stops early and returns null once the time is used up.
 */
export async function embedImages(name: string, paths: string[], view: View = 'orig', budgetMs = Infinity): Promise<Float32Array[] | null> {
  mkdirSync(CACHE, { recursive: true })
  const t0 = Date.now()
  let enc: Awaited<ReturnType<typeof imageEncoder>> | null = null
  const out: Float32Array[] = []
  for (let start = 0; start < paths.length; start += CHUNK) {
    const chunk = paths.slice(start, start + CHUNK)
    const key = createHash('sha1').update(chunk.join('\n')).digest('hex').slice(0, 12)
    const file = join(CACHE, `${name}-${view}-${key}.bin`)
    if (existsSync(file)) {
      const buf = readFileSync(file)
      const all = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
      const d = all.length / chunk.length
      for (let i = 0; i < chunk.length; i++) out.push(all.slice(i * d, (i + 1) * d))
      continue
    }
    if (Date.now() - t0 > budgetMs) return null
    enc ??= await imageEncoder(name)
    const vecs: Float32Array[] = []
    for (const p of chunk) vecs.push(await enc(await viewOf((await RawImage.read(p)).rgb(), view)))
    const d = vecs[0].length
    const all = new Float32Array(vecs.length * d)
    vecs.forEach((v, i) => all.set(v, i * d))
    writeFileSync(file, Buffer.from(all.buffer))
    out.push(...vecs)
    process.stdout.write(`  ${name}/${view} ${Math.min(start + CHUNK, paths.length)}/${paths.length} (${Math.round((Date.now() - t0) / 1000)} s)\n`)
  }
  return out
}

export const dot = (a: Float32Array, b: Float32Array) => {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}
