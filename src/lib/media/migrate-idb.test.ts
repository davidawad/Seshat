import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { cardFrontBack } from '../../features/study/card-summary'
import { type StudyCard, appStateSchema } from '../../types'
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from '../storage'
import { sha256Hex } from './hash'
import { createIdbMediaStore } from './idb-store'
import { createIdbLegacyStore } from './legacy-store'
import { BEFORE_RESTORE_KEY, LEGACY_COPY_KEY, restoreLegacyCopy, runMigration } from './migrate'
import { createMemoryMediaStore } from './store'
import {
  type Harness,
  dataUrlOf,
  expectV1Intact,
  fakeStorage,
  harness,
  identityProcess,
  imageCards,
  occlusionCard,
  pngBytes,
  stateWith,
  textCard,
  v1Raw,
} from './test-helpers'

describe('against a real (fake-indexeddb) database', () => {
  const idbHarness = (raw: string): Harness => {
    const factory = new IDBFactory()
    return harness({
      storage: fakeStorage({ [LEGACY_STORAGE_KEY]: raw }),
      store: createIdbMediaStore(factory),
      legacy: createIdbLegacyStore(factory) as never,
    })
  }

  it('migrates, persists the blobs and the rollback copy durably, and restore works', async () => {
    const raw = v1Raw(stateWith(imageCards()))
    const h = idbHarness(raw)
    expect(await runMigration(h)).toEqual({ status: 'migrated', images: 2, v1Removed: true })
    expect((await h.store.list()).length).toBe(2)
    expect(await h.legacy.get(LEGACY_COPY_KEY)).toBe(raw)
    expect((await restoreLegacyCopy(h)).ok).toBe(true)
    expect(await h.legacy.get(BEFORE_RESTORE_KEY)).not.toBeNull()
  })

  it('unavailable IndexedDB fails safe: v1 intact, nothing half-written', async () => {
    const raw = v1Raw(stateWith(imageCards()))
    const h = harness({
      storage: fakeStorage({ [LEGACY_STORAGE_KEY]: raw }),
      store: createIdbMediaStore(null as never),
      legacy: createIdbLegacyStore(null as never) as never,
    })
    expect(await runMigration(h)).toMatchObject({ status: 'failed', stage: 'store' })
    expectV1Intact(h, raw)
  })
})

describe('property: migration preserves what every card renders', () => {
  const imageArb = fc.integer({ min: 0, max: 5 }).map((seed) => dataUrlOf(pngBytes(seed, 16 + seed)))
  const cardArb = fc.oneof(
    fc.constant(null).map(() => 'text' as const),
    imageArb,
  )

  it('random v1 states -> migrate -> same front/back, same image bytes, v2 is pure text + refs', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(cardArb, { maxLength: 8 }), async (kinds) => {
        const cards = kinds.map((kind, i) => (kind === 'text' ? textCard(i + 1) : occlusionCard(i + 1, kind)))
        const raw = v1Raw(stateWith(cards))
        const h = harness({ storage: fakeStorage({ [LEGACY_STORAGE_KEY]: raw }), store: createMemoryMediaStore() })
        const outcome = await runMigration(h)
        expect(outcome.status).toBe('migrated')

        const v2 = appStateSchema.parse(JSON.parse(h.storage.read(STORAGE_KEY) ?? ''))
        expect(h.storage.read(LEGACY_STORAGE_KEY)).toBeNull()
        expect(h.storage.read(STORAGE_KEY)).not.toContain('data:')
        expect(v2.cards).toHaveLength(cards.length)

        for (const [i, card] of v2.cards.entries()) {
          const before = cardFrontBack(cards[i] as StudyCard)
          const after = cardFrontBack(card)
          expect({ front: after.front, back: after.back }).toEqual({ front: before.front, back: before.back })
          if (before.imageDataUrl === undefined) {
            expect(after.image).toBeUndefined()
          } else {
            expect(after.imageDataUrl).toBeUndefined()
            const stored = await h.store.get(after.image?.id ?? '')
            const originalBytes = (await identityProcess(await await fetchBlob(before.imageDataUrl))).blob
            expect(await sha256Hex(stored as Blob)).toBe(await sha256Hex(originalBytes))
          }
        }
        // Idempotent: nothing left to do.
        expect((await runMigration(h)).status).toBe('not-needed')
      }),
      { numRuns: 40 },
    )
  })
})

const fetchBlob = async (dataUrl: string): Promise<Blob> => {
  const { dataUrlToBlob } = await import('./data-url')
  return dataUrlToBlob(dataUrl)
}
