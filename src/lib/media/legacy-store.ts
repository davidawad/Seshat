import { LEGACY_STORE_NAME, MEDIA_DB_NAME, openDatabase, toStoreError } from './idb-store'
import { MediaStoreError } from './store'

/**
 * Rollback copies of pre-migration app state: a tiny string -> string store
 * living in the same IndexedDB database as the media blobs (its own object
 * store), so a copy survives exactly as long as the images it was taken with.
 * `put` resolves only after the write has committed.
 */
export interface LegacyStore {
  put(key: string, value: string): Promise<void>
  get(key: string): Promise<string | null>
}

/** In-memory fake for tests (and nothing else: a memory copy is NOT a durable rollback). */
export const createMemoryLegacyStore = (): LegacyStore => {
  const entries = new Map<string, string>()
  return {
    put: async (key, value) => {
      entries.set(key, value)
    },
    get: async (key) => entries.get(key) ?? null,
  }
}

export const createIdbLegacyStore = (
  factory: IDBFactory | undefined = globalThis.indexedDB,
  name: string = MEDIA_DB_NAME,
): LegacyStore => {
  let dbPromise: Promise<IDBDatabase> | null = null
  const database = (): Promise<IDBDatabase> => {
    if (!factory) return Promise.reject(new MediaStoreError('unavailable', 'IndexedDB is not available.'))
    dbPromise ??= openDatabase(factory, name, () => {
      dbPromise = null
    }).catch((error: unknown) => {
      dbPromise = null
      throw toStoreError(error)
    })
    return dbPromise
  }

  const run = async <T>(
    mode: IDBTransactionMode,
    body: (store: IDBObjectStore, result: (value: T) => void) => void,
    fallback: T,
  ): Promise<T> => {
    const db = await database()
    return new Promise<T>((resolve, reject) => {
      try {
        const tx = db.transaction(LEGACY_STORE_NAME, mode, mode === 'readwrite' ? { durability: 'strict' } : undefined)
        let value = fallback
        tx.oncomplete = () => resolve(value)
        tx.onabort = () => reject(toStoreError(tx.error ?? new Error('transaction aborted')))
        tx.onerror = () => undefined // surfaces through onabort
        body(tx.objectStore(LEGACY_STORE_NAME), (v) => {
          value = v
        })
      } catch (cause) {
        reject(toStoreError(cause))
      }
    })
  }

  return {
    put: (key, value) =>
      run<undefined>(
        'readwrite',
        (store) => {
          store.put(value, key)
        },
        undefined,
      ),
    get: (key) =>
      run<string | null>(
        'readonly',
        (store, result) => {
          const req = store.get(key)
          req.onsuccess = () => result(typeof req.result === 'string' ? req.result : null)
        },
        null,
      ),
  }
}
