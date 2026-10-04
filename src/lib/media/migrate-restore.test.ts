import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { appStateSchema } from '../../types'
import { STORAGE_KEY, parseLegacyState } from '../storage'
import { BEFORE_RESTORE_KEY, LEGACY_COPY_KEY, hasLegacyCopy, restoreLegacyCopy, runMigration } from './migrate'
import { fakeStorage, harness, imageCards, stateWith, textCard, v1Raw, withV1 } from './test-helpers'

describe('restoreLegacyCopy', () => {
  it('puts the pre-migration data back (inline images) and parks the current v2 first', async () => {
    const { h, raw } = withV1(imageCards())
    await runMigration(h)
    const v2Before = h.storage.read(STORAGE_KEY)

    const result = await restoreLegacyCopy(h)
    expect(result.ok).toBe(true)
    expect(h.legacy.data.get(BEFORE_RESTORE_KEY)).toBe(v2Before)
    const restored = appStateSchema.parse(JSON.parse(h.storage.read(STORAGE_KEY) ?? ''))
    const original = parseLegacyState(raw)
    expect(original.ok && restored.cards).toEqual(original.ok && original.value.cards)
    expect(await hasLegacyCopy(h.legacy)).toBe(true)
  })

  it('refuses cleanly when there is no copy, when it is unreadable, or when it cannot park the current data', async () => {
    const h = harness({ storage: fakeStorage({ [STORAGE_KEY]: 'current' }) })
    expect(await restoreLegacyCopy(h)).toMatchObject({ ok: false })
    expect(await hasLegacyCopy(h.legacy)).toBe(false)

    h.legacy.data.set(LEGACY_COPY_KEY, '{not json')
    expect(await restoreLegacyCopy(h)).toMatchObject({ ok: false })

    h.legacy.data.set(LEGACY_COPY_KEY, v1Raw(stateWith([textCard(1)])))
    const noPark = {
      ...h,
      legacy: {
        ...h.legacy,
        put: async () => {
          throw new Error('no space')
        },
      },
    }
    expect(await restoreLegacyCopy(noPark)).toMatchObject({ ok: false })
    expect(h.storage.read(STORAGE_KEY)).toBe('current')

    const throwingGet = {
      ...h,
      legacy: {
        ...h.legacy,
        get: async () => {
          throw new Error('idb down')
        },
      },
    }
    expect(await restoreLegacyCopy(throwingGet)).toMatchObject({ ok: false })
    expect(await hasLegacyCopy(throwingGet.legacy)).toBe(false)
  })

  it('parks nothing when there was no v2, and a failed write changes nothing', async () => {
    const h = harness()
    h.legacy.data.set(LEGACY_COPY_KEY, v1Raw(stateWith([textCard(1)])))
    h.storage.failWriteFor = STORAGE_KEY
    expect(await restoreLegacyCopy(h)).toMatchObject({ ok: false })
    expect(h.storage.read(STORAGE_KEY)).toBeNull()
    h.storage.failWriteFor = null
    expect((await restoreLegacyCopy(h)).ok).toBe(true)
    expect(h.legacy.data.has(BEFORE_RESTORE_KEY)).toBe(false)
  })

  it('parked copy that does not read back aborts before touching the current data', async () => {
    const h = harness({ storage: fakeStorage({ [STORAGE_KEY]: 'current' }) })
    h.legacy.data.set(LEGACY_COPY_KEY, v1Raw(stateWith([textCard(1)])))
    const lying = {
      ...h,
      legacy: { put: async () => undefined, get: async (k: string) => h.legacy.data.get(k) ?? null },
    }
    expect(await restoreLegacyCopy(lying)).toMatchObject({ ok: false })
    expect(h.storage.read(STORAGE_KEY)).toBe('current')
  })
})
