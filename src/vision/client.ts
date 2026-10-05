import type { VisionRequest, VisionResponse } from './worker'

export type Progress = { loaded: number; total: number }
type Pending = { resolve: (s: { foodId: string; p: number }[], ms: number) => void; reject: (e: Error) => void }

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, Pending>()
const progressListeners = new Set<(p: Progress) => void>()
let ready = false

function get(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<VisionResponse>) => {
    const m = e.data
    if (m.type === 'progress') progressListeners.forEach((l) => l({ loaded: m.loaded, total: m.total }))
    else if (m.type === 'ready') ready = true
    else if (m.type === 'result') {
      pending.get(m.id)?.resolve(m.scores, m.ms)
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

export const isReady = () => ready

export function onProgress(fn: (p: Progress) => void) {
  progressListeners.add(fn)
  return () => progressListeners.delete(fn)
}

/** Start downloading the model before the user needs it. */
export function warmup() {
  get().postMessage({ type: 'warmup' } satisfies VisionRequest)
}

export function classify(image: Blob): Promise<{ scores: { foodId: string; p: number }[]; ms: number }> {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: (scores, ms) => resolve({ scores, ms }), reject })
    get().postMessage({ type: 'classify', id, image } satisfies VisionRequest)
  })
}
