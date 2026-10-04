import {
  describeBlob,
  MediaStoreError,
  readStorageEstimate,
  toRef,
  type BlobDescription,
  type MediaStore,
} from './store'

export const MEDIA_DB_NAME = 'seshat-media'
const DB_VERSION = 1
const BLOBS = 'blobs'
/** Reserved for later migration rollback copies (key string -> string). Unused by this adapter. */
const LEGACY = 'legacy'

interface BlobRecord extends BlobDescription {
  readonly blob: Blob
  readonly createdAt: number
}

/** Maps anything IndexedDB can throw/emit onto the typed error callers see. */
export const toStoreError = (cause: unknown): MediaStoreError => {
  if (cause instanceof MediaStoreError) return cause
  const name = (cause as { name?: unknown } | null)?.name
  if (name === 'QuotaExceededError') {
    return new MediaStoreError('quota-exceeded', 'Browser storage is full; free up space or remove images.', { cause })
  }
  if (name === 'InvalidStateError' || name === 'SecurityError' || name === 'NotFoundError') {
    return new MediaStoreError('unavailable', 'Image storage is unavailable in this browser context.', { cause })
  }
  return new MediaStoreError('failed', 'Image storage operation failed.', { cause })
}

const openDatabase = (factory: IDBFactory, name: string, onVersionChange: () => void): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    let settled = false
    let request: IDBOpenDBRequest
    try {
      request = factory.open(name, DB_VERSION)
    } catch (cause) {
      reject(new MediaStoreError('unavailable', 'Cannot open image storage.', { cause }))
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(LEGACY)) db.createObjectStore(LEGACY)
    }
    request.onsuccess = () => {
      const db = request.result
      if (settled) {
        db.close() // we already gave up on a blocked open
        return
      }
      settled = true
      db.onversionchange = () => {
        db.close()
        onVersionChange()
      }
      resolve(db)
    }
    request.onerror = () => {
      settled = true
      reject(new MediaStoreError('unavailable', 'Cannot open image storage.', { cause: request.error }))
    }
    request.onblocked = () => {
      settled = true
      reject(new MediaStoreError('unavailable', 'Image storage is blocked by another open tab; close it and retry.'))
    }
  })

/**
 * Runs `body` inside one transaction and resolves with the value it passes to
 * `result` only once the transaction has COMPLETED (durably committed).
 */
const transact = <T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  body: (store: IDBObjectStore, result: (value: T) => void, fail: (cause: unknown) => void) => void,
  fallback: T,
): Promise<T> =>
  new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(BLOBS, mode)
      let value = fallback
      let failure: unknown
      tx.oncomplete = () => resolve(value)
      tx.onabort = () => reject(toStoreError(failure ?? tx.error ?? new Error('transaction aborted')))
      tx.onerror = () => undefined // surfaces through onabort
      body(
        tx.objectStore(BLOBS),
        (v) => {
          value = v
        },
        (cause) => {
          failure = cause
          tx.abort()
        },
      )
    } catch (cause) {
      reject(toStoreError(cause))
    }
  })

export const createIdbMediaStore = (
  factory: IDBFactory | undefined = globalThis.indexedDB,
  name: string = MEDIA_DB_NAME,
): MediaStore => {
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
    body: (store: IDBObjectStore, result: (value: T) => void, fail: (cause: unknown) => void) => void,
    fallback: T,
  ): Promise<T> => transact(await database(), mode, body, fallback)

  const list: MediaStore['list'] = () =>
    run(
      'readonly',
      (store, result) => {
        const req = store.getAll()
        req.onsuccess = () =>
          result((req.result as BlobRecord[]).map((r) => ({ id: r.id, bytes: r.bytes, createdAt: r.createdAt })))
      },
      [] as { id: string; bytes: number; createdAt: number }[],
    )

  return {
    async put(blob, meta) {
      const desc = await describeBlob(blob, meta)
      const stored = await run<BlobDescription | null>(
        'readwrite',
        (store, result, fail) => {
          const lookup = store.get(desc.id)
          lookup.onsuccess = () => {
            const existing = lookup.result as BlobRecord | undefined
            if (existing) {
              result(existing)
              return
            }
            const record: BlobRecord = { ...desc, blob, createdAt: Date.now() }
            try {
              store.put(record)
              result(desc)
            } catch (cause) {
              fail(cause) // a throw inside a callback is not routed to the transaction's error
            }
          }
        },
        null,
      )
      return toRef(stored ?? desc, meta)
    },
    get: (id) =>
      run<Blob | null>(
        'readonly',
        (store, result) => {
          const req = store.get(id)
          req.onsuccess = () => result((req.result as BlobRecord | undefined)?.blob ?? null)
        },
        null,
      ),
    has: (id) =>
      run<boolean>(
        'readonly',
        (store, result) => {
          const req = store.count(id)
          req.onsuccess = () => result(req.result > 0)
        },
        false,
      ),
    delete: (id) =>
      run<undefined>(
        'readwrite',
        (store) => {
          store.delete(id)
        },
        undefined,
      ),
    list,
    async usage() {
      const items = await list()
      return {
        bytes: items.reduce((sum, i) => sum + i.bytes, 0),
        count: items.length,
        ...(await readStorageEstimate()),
      }
    },
  }
}
