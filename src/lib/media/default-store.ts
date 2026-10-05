import { createIdbMediaStore } from './idb-store'
import { createMemoryMediaStore, MediaStoreError, type MediaStore } from './store'

/**
 * Lazily-created store: IndexedDB when it opens, otherwise (undefined,
 * blocked, private mode) a process-lifetime in-memory store so the UI still works.
 * The choice is made once, on first use, and then sticks.
 */
export const createDefaultMediaStore = (
  makePrimary: () => MediaStore = () => createIdbMediaStore(),
  makeFallback: () => MediaStore = () => createMemoryMediaStore(),
): MediaStore => {
  let chosen: Promise<MediaStore> | null = null
  const resolve = (): Promise<MediaStore> => {
    chosen ??= (async () => {
      const primary = makePrimary()
      try {
        await primary.has('0'.repeat(64)) // forces the database open
        return primary
      } catch (error) {
        if (error instanceof MediaStoreError && error.kind === 'unavailable') return makeFallback()
        return primary
      }
    })()
    return chosen
  }
  return {
    put: async (blob, meta) => (await resolve()).put(blob, meta),
    get: async (id) => (await resolve()).get(id),
    has: async (id) => (await resolve()).has(id),
    delete: async (id) => (await resolve()).delete(id),
    list: async () => (await resolve()).list(),
    usage: async () => (await resolve()).usage(),
  }
}

let shared: MediaStore | null = null

/** The one process-wide default store (what the provider and non-React code like window.seshat share). */
export const getSharedMediaStore = (): MediaStore => (shared ??= createDefaultMediaStore())
