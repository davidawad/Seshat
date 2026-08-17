// Minimal offline cache for a fully client-side app: no precache manifest
// (Vite's hashed filenames would make one go stale immediately), just
// runtime caching so repeat visits and offline reloads work.
const CACHE_NAME = 'seshat-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        })
        // `self.registration.scope` (not a hardcoded '/') so this falls
        // back to the app shell correctly under a subpath deploy like
        // GitLab Pages' /seshat/, not just when served from the domain root.
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match(self.registration.scope))),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached !== undefined) return cached
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})
