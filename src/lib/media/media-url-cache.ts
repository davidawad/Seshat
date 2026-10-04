import type { MediaStore } from './store'

interface Entry {
  count: number
  url: string | null
  readonly promise: Promise<string | null>
}

export interface UrlHandle {
  readonly promise: Promise<string | null>
  /** Idempotent. The object URL is revoked when the last handle for an id is released. */
  release(): void
}

const caches = new WeakMap<MediaStore, Map<string, Entry>>()

const cacheFor = (store: MediaStore): Map<string, Entry> => {
  let cache = caches.get(store)
  if (!cache) {
    cache = new Map()
    caches.set(store, cache)
  }
  return cache
}

/**
 * Ref-counted object URLs: every user of the same id shares one
 * `URL.createObjectURL`, revoked when the last one releases. A missing blob
 * (null) is never cached, so a later acquire re-queries the store.
 */
export const acquireMediaUrl = (store: MediaStore, id: string): UrlHandle => {
  const cache = cacheFor(store)
  let entry = cache.get(id)
  if (!entry) {
    const fresh: Entry = {
      count: 0,
      url: null,
      promise: store
        .get(id)
        .catch(() => null)
        .then((blob) => {
          if (!blob) {
            if (cache.get(id) === fresh) cache.delete(id)
            return null
          }
          fresh.url = URL.createObjectURL(blob)
          if (fresh.count === 0) {
            // everyone released before the blob arrived
            URL.revokeObjectURL(fresh.url)
            return null
          }
          return fresh.url
        }),
    }
    cache.set(id, fresh)
    entry = fresh
  }
  const held = entry
  held.count += 1
  let released = false
  return {
    promise: held.promise,
    release() {
      if (released) return
      released = true
      held.count -= 1
      if (held.count > 0) return
      if (cache.get(id) === held) cache.delete(id)
      if (held.url) URL.revokeObjectURL(held.url)
    },
  }
}
