import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { Blob as NodeBlob } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'
import { createIdbMediaStore, MEDIA_DB_NAME, toStoreError } from './idb-store'
import { createMemoryMediaStore, MediaStoreError, type MediaStore } from './store'

// jsdom's Blob is lost when fake-indexeddb structured-clones it (real browsers keep it), so use Node's.
const png = (content: string, type = 'image/png') => new NodeBlob([content], { type }) as unknown as Blob
const meta = { width: 10, height: 20 }

const stores: [string, () => MediaStore][] = [
  ['memory', () => createMemoryMediaStore()],
  ['idb', () => createIdbMediaStore(new IDBFactory())],
]

describe.each(stores)('MediaStore contract: %s', (_name, make) => {
  it('put returns a ref and get returns the same bytes', async () => {
    const store = make()
    const ref = await store.put(png('hello'), { ...meta, alt: 'a cat' })
    expect(ref).toMatchObject({ mime: 'image/png', width: 10, height: 20, bytes: 5, alt: 'a cat', decorative: false })
    expect(ref.id).toMatch(/^[0-9a-f]{64}$/)
    const blob = await store.get(ref.id)
    expect(blob?.size).toBe(5)
    expect(blob?.type).toBe('image/png')
  })

  it('dedupes identical bytes but keeps per-call alt', async () => {
    const store = make()
    const a = await store.put(png('same'), { ...meta, alt: 'one' })
    const b = await store.put(png('same'), { ...meta, alt: 'two', decorative: true })
    expect(b.id).toBe(a.id)
    expect(b).toMatchObject({ alt: 'two', decorative: true })
    expect(Object.keys(b).sort()).toEqual(['alt', 'bytes', 'decorative', 'height', 'id', 'mime', 'width'])
    expect(await store.list()).toHaveLength(1)
  })

  it('has/get/delete handle missing ids', async () => {
    const store = make()
    const missing = '0'.repeat(64)
    expect(await store.get(missing)).toBeNull()
    expect(await store.has(missing)).toBe(false)
    const ref = await store.put(png('x'), meta)
    expect(await store.has(ref.id)).toBe(true)
    await store.delete(ref.id)
    expect(await store.has(ref.id)).toBe(false)
    await expect(store.delete(ref.id)).resolves.toBeUndefined()
  })

  it('lists entries and reports usage', async () => {
    const store = make()
    await store.put(png('aaa'), meta)
    await store.put(png('bbbbb'), meta)
    const items = await store.list()
    expect(items.map((i) => i.bytes).sort()).toEqual([3, 5])
    for (const item of items) expect(item.createdAt).toBeGreaterThan(0)
    expect(await store.usage()).toMatchObject({ bytes: 8, count: 2 })
  })

  it('rejects unsupported mime and missing size with a typed error', async () => {
    const store = make()
    await expect(store.put(png('x', 'image/gif'), meta)).rejects.toMatchObject({ kind: 'failed' })
    await expect(store.put(png('x'))).rejects.toBeInstanceOf(MediaStoreError)
  })
})

describe('usage storage estimate', () => {
  it('includes quota and persisted when navigator.storage provides them', async () => {
    vi.stubGlobal('navigator', {
      storage: { estimate: async () => ({ quota: 1000 }), persisted: async () => true },
    })
    try {
      expect(await createMemoryMediaStore().usage()).toEqual({ bytes: 0, count: 0, quota: 1000, persisted: true })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('tolerates failing or absent storage APIs', async () => {
    vi.stubGlobal('navigator', {
      storage: { estimate: () => Promise.reject(new Error('no')), persisted: () => Promise.reject(new Error('no')) },
    })
    try {
      expect(await createMemoryMediaStore().usage()).toEqual({ bytes: 0, count: 0 })
      vi.stubGlobal('navigator', {})
      expect(await createMemoryMediaStore().usage()).toEqual({ bytes: 0, count: 0 })
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('idb adapter specifics', () => {
  it('creates the blobs and legacy stores', async () => {
    const factory = new IDBFactory()
    await createIdbMediaStore(factory).put(png('x'), meta)
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = factory.open(MEDIA_DB_NAME)
      req.onsuccess = () => resolve(req.result)
    })
    expect(Array.from(db.objectStoreNames).sort()).toEqual(['blobs', 'legacy'])
    db.close()
  })

  it('persists across store instances on the same factory', async () => {
    const factory = new IDBFactory()
    const ref = await createIdbMediaStore(factory).put(png('persist'), meta)
    expect(await createIdbMediaStore(factory).has(ref.id)).toBe(true)
  })

  it('reports unavailable without IndexedDB', async () => {
    vi.stubGlobal('indexedDB', undefined)
    try {
      await expect(createIdbMediaStore().has('0'.repeat(64))).rejects.toMatchObject({ kind: 'unavailable' })
    } finally {
      vi.unstubAllGlobals()
    }
    const throwing = {
      open: () => {
        throw new Error('denied')
      },
    } as unknown as IDBFactory
    await expect(createIdbMediaStore(throwing).list()).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('maps a QuotaExceededError thrown by a write to quota-exceeded', async () => {
    const store = createIdbMediaStore(new IDBFactory())
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    try {
      await expect(store.put(png('big'), meta)).rejects.toMatchObject({ kind: 'quota-exceeded' })
    } finally {
      spy.mockRestore()
    }
  })

  it('maps an aborted transaction to a typed error', async () => {
    const store = createIdbMediaStore(new IDBFactory())
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore) {
      this.transaction.abort()
      return undefined as never
    })
    try {
      await expect(store.put(png('abort'), meta)).rejects.toBeInstanceOf(MediaStoreError)
    } finally {
      spy.mockRestore()
    }
  })

  it('drops the cached connection on versionchange and fails with a typed error', async () => {
    const factory = new IDBFactory()
    const store = createIdbMediaStore(factory)
    const ref = await store.put(png('vc'), meta)
    await new Promise<void>((resolve, reject) => {
      const req = factory.open(MEDIA_DB_NAME, 2) // fires versionchange on the open connection
      req.onsuccess = () => {
        req.result.close()
        resolve()
      }
      req.onerror = () => reject(req.error)
    })
    // The adapter asks for v1 but the db is now v2: reopening fails, and must do so with a typed error.
    await expect(store.has(ref.id)).rejects.toBeInstanceOf(MediaStoreError)
  })

  it('reports unavailable when the open is blocked', async () => {
    const factory = {
      open: () => {
        const req = {} as IDBOpenDBRequest
        queueMicrotask(() => req.onblocked?.call(req, new Event('blocked') as IDBVersionChangeEvent))
        return req as IDBOpenDBRequest
      },
    } as unknown as IDBFactory
    await expect(createIdbMediaStore(factory).has('0'.repeat(64))).rejects.toMatchObject({ kind: 'unavailable' })
  })
})

describe('toStoreError', () => {
  it('classifies by error name and passes typed errors through', () => {
    expect(toStoreError(new DOMException('x', 'QuotaExceededError')).kind).toBe('quota-exceeded')
    expect(toStoreError(new DOMException('x', 'InvalidStateError')).kind).toBe('unavailable')
    expect(toStoreError(new Error('boom')).kind).toBe('failed')
    expect(toStoreError(null).kind).toBe('failed')
    const typed = new MediaStoreError('quota-exceeded', 'q')
    expect(toStoreError(typed)).toBe(typed)
  })
})
