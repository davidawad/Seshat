import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { appStateSchema } from '../../types'
import { LEGACY_STORAGE_KEY, STORAGE_KEY, parseLegacyState } from '../storage'
import { sha256Hex } from './hash'
import { LEGACY_COPY_KEY, runMigration } from './migrate'
import { MediaStoreError, type MediaStore } from './store'
import {
  type Harness,
  dataUrlOf,
  expectV1Intact,
  fakeStorage,
  harness,
  imageCards,
  nodeBlob,
  occlusionCard,
  pngBytes,
  stateWith,
  textCard,
  v1Raw,
  withV1,
} from './test-helpers'

describe('runMigration: happy path', () => {
  it('moves images into the store, writes a small text+refs v2, keeps a rollback copy, then removes v1', async () => {
    const big = [
      textCard(1),
      occlusionCard(2, dataUrlOf(pngBytes(1, 6000))),
      occlusionCard(3, dataUrlOf(pngBytes(2, 6000))),
    ]
    const { h, raw } = withV1(big)
    const outcome = await runMigration(h)
    expect(outcome).toEqual({ status: 'migrated', images: 2, v1Removed: true })

    expect(h.storage.read(LEGACY_STORAGE_KEY)).toBeNull()
    expect(h.legacy.data.get(LEGACY_COPY_KEY)).toBe(raw)

    const v2raw = h.storage.read(STORAGE_KEY) ?? ''
    expect(v2raw).not.toContain('data:image')
    expect(v2raw).not.toContain('imageDataUrl')
    expect(v2raw.length).toBeLessThan(raw.length)
    const v2 = appStateSchema.parse(JSON.parse(v2raw))
    expect(v2.version).toBe(2)

    expect((await h.store.list()).length).toBe(2) // the repeated picture is stored once
    for (const card of v2.cards) {
      if (card.content.kind !== 'image-occlusion') continue
      const ref = card.content.image
      expect(ref).not.toBeNull()
      const blob = await h.store.get(ref?.id ?? '')
      expect(await sha256Hex(blob as Blob)).toBe(ref?.id)
    }
  })

  it('keeps non-image data exactly (sets, text cards, ids, scheduling, settings, review log)', async () => {
    const { h } = withV1(imageCards())
    await runMigration(h)
    const before = parseLegacyState(v1Raw(stateWith(imageCards()))).ok
    expect(before).toBe(true)
    const v2 = appStateSchema.parse(JSON.parse(h.storage.read(STORAGE_KEY) ?? ''))
    expect(v2.cards.map((c) => c.id)).toEqual(imageCards().map((c) => c.id))
    expect(v2.cards[0]).toEqual(imageCards()[0])
    expect(v2.cards[1]?.scheduling).toEqual(imageCards()[1]?.scheduling)
    expect(v2.sets).toEqual(stateWith([]).sets)
  })

  it('with no images there is nothing to roll back: v2 is written and v1 removed without a legacy copy', async () => {
    const { h } = withV1([textCard(1), textCard(2)])
    expect(await runMigration(h)).toEqual({ status: 'migrated', images: 0, v1Removed: true })
    expect(h.legacy.data.size).toBe(0)
    expect(h.storage.read(STORAGE_KEY)).not.toBeNull()
  })

  it('does nothing when there is no v1, or when v2 already exists', async () => {
    const empty = harness()
    expect(await runMigration(empty)).toEqual({ status: 'not-needed' })
    expect(empty.storage.data.size).toBe(0)

    const { h, raw } = withV1(imageCards())
    h.storage.data.set(STORAGE_KEY, 'existing-v2-untouched')
    expect(await runMigration(h)).toEqual({ status: 'not-needed' })
    expect(h.storage.read(STORAGE_KEY)).toBe('existing-v2-untouched')
    expect(h.storage.read(LEGACY_STORAGE_KEY)).toBe(raw) // not equal to a rollback copy, so it is left alone
  })

  it('is idempotent: a second run changes nothing', async () => {
    const { h } = withV1(imageCards())
    await runMigration(h)
    const snapshot = [...h.storage.data.entries()]
    const blobs = (await h.store.list()).length
    expect(await runMigration(h)).toEqual({ status: 'not-needed' })
    expect([...h.storage.data.entries()]).toEqual(snapshot)
    expect((await h.store.list()).length).toBe(blobs)
  })
})

const failing = (name: string, setup: (h: Harness) => void, stage: string) =>
  it(`${name} -> failed at "${stage}", v1 intact, next boot succeeds`, async () => {
    const { h, raw } = withV1(imageCards())
    const good = { ...h } // the healthy dependencies, for the retry
    setup(h)
    const outcome = await runMigration(h)
    expect(outcome).toMatchObject({ status: 'failed', stage })
    expectV1Intact(h, raw)

    // The failure was transient: retry on the "next boot" with the problem gone.
    h.storage.failWriteFor = null
    h.storage.dropWriteFor = null
    expect(await runMigration(good)).toMatchObject({ status: 'migrated', v1Removed: true })
    expect(appStateSchema.safeParse(JSON.parse(h.storage.read(STORAGE_KEY) ?? '')).success).toBe(true)
  })

describe('runMigration: every failure leaves v1 untouched and retries cleanly', () => {
  it('decode failure (corrupt data URL)', async () => {
    const raw = v1Raw(stateWith([textCard(1), occlusionCard(2, 'data:image/png;base64,@@@not-base64@@@')]))
    const h = harness({ storage: fakeStorage({ [LEGACY_STORAGE_KEY]: raw }) })
    expect(await runMigration(h)).toMatchObject({ status: 'failed', stage: 'decode' })
    expectV1Intact(h, raw)
  })

  it('decode failure (not a data URL at all)', async () => {
    const raw = v1Raw(stateWith([occlusionCard(2, 'https://example.com/x.png')]))
    const h = harness({ storage: fakeStorage({ [LEGACY_STORAGE_KEY]: raw }) })
    expect(await runMigration(h)).toMatchObject({ status: 'failed', stage: 'decode' })
    expectV1Intact(h, raw)
  })

  failing(
    'image pipeline throws (undecodable image)',
    (h) => {
      Object.assign(h, {
        process: async () => {
          throw new Error('cannot decode')
        },
      })
    },
    'process',
  )

  failing(
    'put hits the storage quota',
    (h) => {
      const real = h.store
      Object.assign(h, {
        store: {
          ...real,
          put: async () => {
            throw new MediaStoreError('quota-exceeded', 'full')
          },
        } satisfies MediaStore,
      })
    },
    'store',
  )

  failing(
    'read-back returns different bytes',
    (h) => {
      const real = h.store
      Object.assign(h, { store: { ...real, get: async () => nodeBlob(pngBytes(99)) } satisfies MediaStore })
    },
    'verify',
  )

  failing(
    'read-back finds nothing',
    (h) => {
      const real = h.store
      Object.assign(h, { store: { ...real, get: async () => null } satisfies MediaStore })
    },
    'verify',
  )

  failing(
    'read-back throws',
    (h) => {
      const real = h.store
      Object.assign(h, {
        store: {
          ...real,
          get: async () => {
            throw new Error('idb gone')
          },
        } satisfies MediaStore,
      })
    },
    'verify',
  )
})

describe('runMigration: failures after the images are stored', () => {
  failing(
    'rollback copy cannot be written',
    (h) => {
      Object.assign(h, {
        legacy: {
          ...h.legacy,
          put: async () => {
            throw new Error('legacy quota')
          },
        },
      })
    },
    'legacy-copy',
  )

  failing(
    'rollback copy reads back different',
    (h) => {
      Object.assign(h, { legacy: { ...h.legacy, get: async () => 'something else' } })
    },
    'legacy-copy',
  )

  failing(
    'v2 write fails (localStorage quota)',
    (h) => {
      h.storage.failWriteFor = STORAGE_KEY
    },
    'write-v2',
  )

  failing(
    'v2 write reports success but does not land (read-back mismatch)',
    (h) => {
      h.storage.dropWriteFor = STORAGE_KEY
    },
    'write-v2',
  )

  it('a corrupt v1 is never touched and is reported', async () => {
    const h = harness({ storage: fakeStorage({ [LEGACY_STORAGE_KEY]: '{not json' }) })
    expect(await runMigration(h)).toMatchObject({ status: 'failed', stage: 'parse' })
    expect(h.storage.read(LEGACY_STORAGE_KEY)).toBe('{not json')
    expect(h.storage.read(STORAGE_KEY)).toBeNull()
  })

  it('a v1 that fails validation is left alone', async () => {
    const h = harness({ storage: fakeStorage({ [LEGACY_STORAGE_KEY]: JSON.stringify({ version: 1, sets: 'x' }) }) })
    expect(await runMigration(h)).toMatchObject({ status: 'failed', stage: 'parse' })
    expect(h.storage.read(STORAGE_KEY)).toBeNull()
  })

  it('an unexpected throw is contained as a failure (the app keeps running)', async () => {
    const { h, raw } = withV1(imageCards())
    const exploding = {
      ...h,
      storage: {
        ...h.storage,
        read: () => {
          throw new Error('boom')
        },
      },
    }
    expect(await runMigration(exploding)).toMatchObject({ status: 'failed', stage: 'unexpected' })
    expect(h.storage.read(LEGACY_STORAGE_KEY)).toBe(raw)
  })

  it('a failed v2 write leaves no partial v2 behind even if remove is the only thing that works', async () => {
    const { h, raw } = withV1(imageCards())
    h.storage.dropWriteFor = STORAGE_KEY
    await runMigration(h)
    expect(h.storage.data.has(STORAGE_KEY)).toBe(false)
    expect(h.storage.read(LEGACY_STORAGE_KEY)).toBe(raw)
  })
})
