import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { appStateSchema } from '../../types'
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from '../storage'
import { migrationPending, runMigration, staleV1Present } from './migrate'
import { identityProcess, imageCards, noLock, stateWith, textCard, v1Raw, withV1 } from './test-helpers'

describe('runMigration: v1 removal failure', () => {
  it('v2 is the source of truth; the stale v1 is cleaned on a later boot only because it equals the rollback copy', async () => {
    const { h, raw } = withV1(imageCards())
    h.storage.failRemoveFor = LEGACY_STORAGE_KEY
    expect(await runMigration(h)).toEqual({ status: 'migrated', images: 2, v1Removed: false })
    expect(h.storage.read(STORAGE_KEY)).not.toBeNull()
    expect(h.storage.read(LEGACY_STORAGE_KEY)).toBe(raw)
    expect(staleV1Present(h.storage)).toBe(true)
    expect(migrationPending(h.storage)).toBe(false)

    h.storage.failRemoveFor = null
    expect(await runMigration(h)).toEqual({ status: 'not-needed' })
    expect(h.storage.read(LEGACY_STORAGE_KEY)).toBeNull()
    expect(h.storage.read(STORAGE_KEY)).not.toBeNull()
  })

  it('a stale v1 that differs from the rollback copy is never deleted', async () => {
    const { h } = withV1(imageCards())
    h.storage.failRemoveFor = LEGACY_STORAGE_KEY
    await runMigration(h)
    h.storage.data.set(LEGACY_STORAGE_KEY, 'edited later')
    h.storage.failRemoveFor = null
    await runMigration(h)
    expect(h.storage.read(LEGACY_STORAGE_KEY)).toBe('edited later')
  })

  it('stale-v1 cleanup tolerates an unreadable legacy store', async () => {
    const { h, raw } = withV1(imageCards())
    h.storage.failRemoveFor = LEGACY_STORAGE_KEY
    await runMigration(h)
    h.storage.failRemoveFor = null
    const broken = {
      ...h,
      legacy: {
        put: h.legacy.put,
        get: async () => {
          throw new Error('idb down')
        },
      },
    }
    expect(await runMigration(broken)).toEqual({ status: 'not-needed' })
    expect(h.storage.read(LEGACY_STORAGE_KEY)).toBe(raw)
  })
})

describe('runMigration: two tabs booting at once', () => {
  it('with a lock: exactly one migrates, the other finds v2; images and rollback copy written once', async () => {
    const { h } = withV1(imageCards())
    let legacyPuts = 0
    const countingLegacy = {
      ...h.legacy,
      put: async (k: string, v: string) => {
        legacyPuts += 1
        await h.legacy.put(k, v)
      },
    }
    const deps = { ...h, legacy: countingLegacy }
    const outcomes = await Promise.all([runMigration(deps), runMigration(deps)])
    expect(outcomes.map((o) => o.status).sort()).toEqual(['migrated', 'not-needed'])
    expect(legacyPuts).toBe(1)
    expect(h.storage.read(LEGACY_STORAGE_KEY)).toBeNull()
    expect(appStateSchema.safeParse(JSON.parse(h.storage.read(STORAGE_KEY) ?? '')).success).toBe(true)
  })

  it('without locks: the pre-write re-check still lets only one writer win and v2 stays valid', async () => {
    const { h } = withV1(imageCards(), { withLock: noLock })
    const outcomes = await Promise.all([runMigration(h), runMigration(h), runMigration(h)])
    expect(outcomes.filter((o) => o.status === 'migrated')).toHaveLength(1)
    expect(outcomes.filter((o) => o.status === 'failed')).toHaveLength(0)
    expect(h.storage.read(LEGACY_STORAGE_KEY)).toBeNull()
    expect(appStateSchema.safeParse(JSON.parse(h.storage.read(STORAGE_KEY) ?? '')).success).toBe(true)
  })

  it('a loser started after the winner re-reads and finds v2 (does not clobber it)', async () => {
    const { h } = withV1(imageCards())
    await runMigration(h)
    const v2 = h.storage.read(STORAGE_KEY)
    h.storage.data.set(LEGACY_STORAGE_KEY, v1Raw(stateWith([textCard(9)]))) // a late v1 writer
    expect(await runMigration(h)).toEqual({ status: 'not-needed' })
    expect(h.storage.read(STORAGE_KEY)).toBe(v2)
  })
})

describe('runMigration: v1 changes while migrating', () => {
  it('aborts (v1 intact, no v2) if a v1-mode tab saved during the migration, and succeeds on the retry', async () => {
    const { h } = withV1(imageCards())
    const edited = v1Raw(stateWith([...imageCards(), textCard(9)]))
    const racing = {
      ...h,
      process: async (blob: Blob) => {
        h.storage.data.set(LEGACY_STORAGE_KEY, edited) // the other tab saves mid-migration
        return identityProcess(blob)
      },
    }
    expect(await runMigration(racing)).toMatchObject({ status: 'failed', stage: 'write-v2' })
    expect(h.storage.read(LEGACY_STORAGE_KEY)).toBe(edited)
    expect(h.storage.read(STORAGE_KEY)).toBeNull()
    expect(await runMigration(h)).toMatchObject({ status: 'migrated' })
    expect(appStateSchema.parse(JSON.parse(h.storage.read(STORAGE_KEY) ?? '')).cards).toHaveLength(5)
  })
})
