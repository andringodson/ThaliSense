// ThaliSense service worker: makes the app installable and usable offline.
// Pages are network-first so updates land immediately; hashed build assets and
// fonts are cache-first. The vision model is cached separately by
// Transformers.js, so after one photo the whole app works without a network.

const CACHE = 'thalisense-v1'
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('thalisense-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const cacheFirst = async (req) => {
  const hit = await caches.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok || res.type === 'opaque') (await caches.open(CACHE)).put(req, res.clone())
  return res
}

const networkFirst = async (req) => {
  try {
    const res = await fetch(req)
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone())
    return res
  } catch {
    return (await caches.match(req)) || (await caches.match('/'))
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (req.mode === 'navigate') return event.respondWith(networkFirst(req))
  if (url.origin === location.origin && url.pathname.startsWith('/assets/')) return event.respondWith(cacheFirst(req))
  if (url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') return event.respondWith(cacheFirst(req))
  if (url.origin === location.origin) return event.respondWith(networkFirst(req))
})
