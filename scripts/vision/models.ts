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
  /** Size of the int8 vision encoder the browser downloads, in MB. */
  visionMB: number
}

export const MODELS: Record<string, ModelSpec> = {
  'clip-b32': { id: 'Xenova/clip-vit-base-patch32', kind: 'clip', padMax: false, visionMB: 89 },
  'clip-b16': { id: 'Xenova/clip-vit-base-patch16', kind: 'clip', padMax: false, visionMB: 87 },
  'mobileclip-s2': { id: 'Xenova/mobileclip_s2', kind: 'clip', padMax: true, visionMB: 37 },
  'mobileclip-b': { id: 'Xenova/mobileclip_b', kind: 'clip', padMax: true, visionMB: 88 },
  'siglip-b16': { id: 'Xenova/siglip-base-patch16-224', kind: 'siglip', padMax: true, visionMB: 99 },
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

export type View = 'orig' | 'flip' | 'crop'

export async function imageEncoder(name: string) {
  const spec = MODELS[name]
  const processor = await AutoProcessor.from_pretrained(spec.id)
  const model =
    spec.kind === 'siglip'
      ? await SiglipVisionModel.from_pretrained(spec.id, { dtype: 'q8' })
      : await CLIPVisionModelWithProjection.from_pretrained(spec.id, { dtype: 'q8' })
  return async (img: RawImage): Promise<Float32Array> => {
    const out = await model(await processor(img))
    const t = spec.kind === 'siglip' ? out.pooler_output : out.image_embeds
    return normalize(t.data as Float32Array)
  }
}

/** Embed image files under a view, caching vectors on disk by model, view and path. */
export async function embedImages(name: string, paths: string[], view: View = 'orig', log = true): Promise<Float32Array[]> {
  mkdirSync(CACHE, { recursive: true })
  const key = createHash('sha1').update(paths.join('\n')).digest('hex').slice(0, 12)
  const file = join(CACHE, `${name}-${view}-${key}.bin`)
  if (existsSync(file)) {
    const buf = readFileSync(file)
    const all = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
    const d = all.length / paths.length
    return Array.from({ length: paths.length }, (_, i) => all.slice(i * d, (i + 1) * d))
  }
  const enc = await imageEncoder(name)
  const out: Float32Array[] = []
  const t0 = Date.now()
  for (const [i, p] of paths.entries()) {
    let img = await RawImage.read(p)
    img = img.rgb()
    if (view === 'flip') img = flip(img)
    if (view === 'crop') img = await centerCrop(img)
    out.push(await enc(img))
    if (log && (i + 1) % 200 === 0) process.stdout.write(`  ${name}/${view} ${i + 1}/${paths.length} (${Math.round((Date.now() - t0) / (i + 1))} ms/img)\n`)
  }
  const d = out[0].length
  const all = new Float32Array(out.length * d)
  out.forEach((v, i) => all.set(v, i * d))
  writeFileSync(file, Buffer.from(all.buffer))
  return out
}

export const dot = (a: Float32Array, b: Float32Array) => {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}
