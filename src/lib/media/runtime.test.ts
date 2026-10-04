import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type AppState, err, ok } from '../../types'
import { bootMigration, browserMigrationDeps } from './boot'
import { cleanUpUnusedImages, referencedMediaIds } from './cleanup'
import { createIdbLegacyStore, createMemoryLegacyStore } from './legacy-store'
import { GC_LOCK, MIGRATE_LOCK, withWebLock } from './locks'
import { LEGACY_COPY_KEY } from './migrate'
import { getMigrationNotice, noticeFor, setMigrationNotice, subscribeMigrationNotice } from './migration-notice'
import { createMemoryMediaStore } from './store'
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from '../storage'
import {
  dataUrlOf,
  fakeStorage,
  harness,
  mutexLock,
  nodeBlob,
  occlusionCard,
  pngBytes,
  stateWith,
  textCard,
  v1Raw,
} from './test-helpers'

const HOUR = 60 * 60 * 1000

describe('cleanUpUnusedImages', () => {
  const setup = async () => {
    const t0 = 1_000_000
    let now = t0
    const store = createMemoryMediaStore(() => now)
    const used = await store.put(nodeBlob(pngBytes(1)), { width: 1, height: 1 })
    const orphanOld = await store.put(nodeBlob(pngBytes(2)), { width: 1, height: 1 })
    now = t0 + 30 * HOUR
    const orphanNew = await store.put(nodeBlob(pngBytes(3)), { width: 1, height: 1 })
    const state: AppState = stateWith([{ ...textCard(1), promptImage: used }])
    const deps = {
      store,
      readState: () => ok(state),
      migrationPending: () => false,
      withLock: mutexLock(),
      now: () => t0 + 31 * HOUR,
    }
    return { store, used, orphanOld, orphanNew, deps }
  }

  it('deletes only unreferenced blobs older than 24h', async () => {
    const { store, used, orphanOld, orphanNew, deps } = await setup()
    const result = await cleanUpUnusedImages(deps)
    expect(result).toEqual({ status: 'done', deleted: 1, freedBytes: orphanOld.bytes })
    expect(await store.has(used.id)).toBe(true)
    expect(await store.has(orphanOld.id)).toBe(false)
    expect(await store.has(orphanNew.id)).toBe(true) // inside the grace period
  })

  it('never deletes anything referenced by ANY card kind (prompt, answer, occlusion image)', async () => {
    const { store, orphanOld, deps } = await setup()
    const answer = {
      ...textCard(2),
      content: { kind: 'short-answer' as const, answer: 'a', acceptableAnswers: [], answerImage: orphanOld },
    }
    const state = stateWith([answer])
    expect([...referencedMediaIds(state)]).toEqual([orphanOld.id])
    const result = await cleanUpUnusedImages({ ...deps, readState: () => ok(state) })
    expect(await store.has(orphanOld.id)).toBe(true)
    expect(result).toMatchObject({ status: 'done' })
  })

  it('does nothing when the state cannot be read or the migration is pending', async () => {
    const { store, deps } = await setup()
    const before = (await store.list()).length
    expect(await cleanUpUnusedImages({ ...deps, readState: () => err('corrupt') })).toMatchObject({ status: 'skipped' })
    expect(await cleanUpUnusedImages({ ...deps, migrationPending: () => true })).toMatchObject({ status: 'skipped' })
    expect((await store.list()).length).toBe(before)
  })

  it('runs under the GC lock and defaults its clock to Date.now', async () => {
    const { deps } = await setup()
    const withLock = vi.fn(deps.withLock) as unknown as typeof deps.withLock
    const { now: _now, ...noClock } = deps
    await cleanUpUnusedImages({ ...noClock, withLock })
    expect(withLock).toHaveBeenCalledWith(GC_LOCK, expect.any(Function))
  })
})

describe('withWebLock', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'locks')
  afterEach(() => {
    if (original) Object.defineProperty(navigator, 'locks', original)
    else Reflect.deleteProperty(navigator, 'locks')
  })
  const setLocks = (value: unknown) => Object.defineProperty(navigator, 'locks', { value, configurable: true })

  it('uses navigator.locks.request with the given name', async () => {
    const request = vi.fn(async (_name: string, cb: () => Promise<unknown>) => cb())
    setLocks({ request })
    await expect(withWebLock(MIGRATE_LOCK, async () => 7)).resolves.toBe(7)
    expect(request).toHaveBeenCalledWith(MIGRATE_LOCK, expect.any(Function))
  })

  it('runs the function directly when locks are unavailable', async () => {
    setLocks(undefined)
    await expect(withWebLock('x', async () => 'ran')).resolves.toBe('ran')
    setLocks({})
    await expect(withWebLock('x', async () => 'ran2')).resolves.toBe('ran2')
  })

  it('falls back when the lock cannot be requested, but does not swallow errors from the work itself', async () => {
    setLocks({ request: async () => Promise.reject(new Error('SecurityError')) })
    await expect(withWebLock('x', async () => 'fallback')).resolves.toBe('fallback')
    setLocks({ request: async (_n: string, cb: () => Promise<unknown>) => cb() })
    await expect(
      withWebLock('x', async () => {
        throw new Error('work failed')
      }),
    ).rejects.toThrow('work failed')
  })
})

describe('migration notice', () => {
  it('describes each outcome', () => {
    expect(noticeFor({ status: 'not-needed' })).toBeNull()
    expect(noticeFor({ status: 'migrated', images: 0, v1Removed: true })).toBeNull()
    expect(noticeFor({ status: 'migrated', images: 1, v1Removed: true })?.text).toContain('1 image ')
    expect(noticeFor({ status: 'migrated', images: 3, v1Removed: true })?.text).toContain('3 images')
    const failed = noticeFor({ status: 'failed', stage: 'store', message: 'Browser storage is full.' })
    expect(failed).toMatchObject({ tone: 'warning' })
    expect(failed?.text).toContain('Nothing was lost')
    expect(failed?.text).toContain('try again')
  })

  it('notifies subscribers and stops after unsubscribe', () => {
    const calls: unknown[] = []
    const stop = subscribeMigrationNotice(() => calls.push(getMigrationNotice()))
    setMigrationNotice({ tone: 'info', text: 'hi' })
    stop()
    setMigrationNotice(null)
    expect(calls).toEqual([{ tone: 'info', text: 'hi' }])
    expect(getMigrationNotice()).toBeNull()
  })
})

describe('legacy store', () => {
  it('memory and IndexedDB variants round-trip strings and return null for missing keys', async () => {
    for (const store of [createMemoryLegacyStore(), createIdbLegacyStore(new IDBFactory())]) {
      expect(await store.get('k')).toBeNull()
      await store.put('k', 'value')
      expect(await store.get('k')).toBe('value')
      await store.put('k', 'newer')
      expect(await store.get('k')).toBe('newer')
    }
  })

  it('the IndexedDB variant rejects (typed) when IndexedDB is unavailable', async () => {
    const store = createIdbLegacyStore(null as never)
    await expect(store.put('k', 'v')).rejects.toMatchObject({ kind: 'unavailable' })
    await expect(store.get('k')).rejects.toMatchObject({ kind: 'unavailable' })
  })
})

describe('bootMigration', () => {
  afterEach(() => {
    setMigrationNotice(null)
  })

  it('does nothing and sets no notice when there is nothing to migrate', async () => {
    expect(await bootMigration(harness())).toEqual({ status: 'not-needed' })
    expect(getMigrationNotice()).toBeNull()
  })

  it('migrates and posts a notice; a failure posts a warning and leaves v1', async () => {
    const raw = v1Raw(stateWith([occlusionCard(1, dataUrlOf(pngBytes(1)))]))
    const ok1 = harness({ storage: fakeStorage({ [LEGACY_STORAGE_KEY]: raw }) })
    expect(await bootMigration(ok1)).toMatchObject({ status: 'migrated', images: 1 })
    expect(getMigrationNotice()?.tone).toBe('info')
    expect(ok1.storage.read(STORAGE_KEY)).not.toBeNull()

    const bad = harness({
      storage: fakeStorage({ [LEGACY_STORAGE_KEY]: raw }),
      process: async () => Promise.reject(new Error('nope')),
    })
    expect(await bootMigration(bad)).toMatchObject({ status: 'failed' })
    expect(getMigrationNotice()?.tone).toBe('warning')
    expect(bad.storage.read(LEGACY_STORAGE_KEY)).toBe(raw)
    expect(bad.legacy.data.has(LEGACY_COPY_KEY)).toBe(false)
  })

  it('builds the real browser wiring without touching storage', () => {
    const deps = browserMigrationDeps()
    expect(Object.keys(deps).sort()).toEqual(['legacy', 'process', 'storage', 'store', 'withLock'])
  })
})
