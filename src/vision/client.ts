import type { Score, VisionRequest, VisionResponse } from './worker'

export type { Score }
export type Progress = { loaded: number; total: number }

type Pending = {
  resolve: (r: { scores: Score[]; ms: number }) => void
  reject: (e: Error) => void
  onRegions?: (found: Score[], ms: number) => void
}

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, Pending>()
const progressListeners = new Set<(p: Progress) => void>()
let device: string | null = null

function get(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<VisionResponse>) => {
    const m = e.data
    if (m.type === 'progress') progressListeners.forEach((l) => l({ loaded: m.loaded, total: m.total }))
    else if (m.type === 'ready') device = m.device
    else if (m.type === 'result') {
      const p = pending.get(m.id)
      p?.resolve({ scores: m.scores, ms: m.ms })
      if (!p?.onRegions) pending.delete(m.id)
    } else if (m.type === 'regions') {
      pending.get(m.id)?.onRegions?.(m.found, m.ms)
      pending.delete(m.id)
    } else if (m.type === 'error') {
      if (m.id !== undefined) {
        pending.get(m.id)?.reject(new Error(m.message))
        pending.delete(m.id)
      } else pending.forEach((p) => p.reject(new Error(m.message)))
    }
  }
  return worker
}

export const isReady = () => device !== null
/** 'webgpu', 'wasm-threads' or 'wasm' once the model has loaded. */
export const backend = () => device

export function onProgress(fn: (p: Progress) => void) {
  progressListeners.add(fn)
  return () => progressListeners.delete(fn)
}

/** Start downloading the model before the user needs it. */
export function warmup() {
  get().postMessage({ type: 'warmup' } satisfies VisionRequest)
}

/**
 * Recognise the dish in a photo. Resolves with the whole-photo ranking; when
 * `onRegions` is given, also scans regions of the plate and reports extra
 * dishes found there.
 */
export function classify(image: Blob, onRegions?: (found: Score[], ms: number) => void): Promise<{ scores: Score[]; ms: number }> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onRegions })
    get().postMessage({ type: 'classify', id, image, thali: !!onRegions } satisfies VisionRequest)
  })
}
