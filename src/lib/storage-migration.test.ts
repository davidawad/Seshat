import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyAppState } from '../types'
import { clearMirrors } from './persistence'
import {
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  clearState,
  loadState,
  resetStorageSourceForTests,
  saveState,
  subscribeToAppState,
} from './storage'

beforeEach(() => {
  window.localStorage.clear()
  clearMirrors()
  resetStorageSourceForTests()
})

describe('v1 -> v2 key handling (migration pending or failed)', () => {
  const v1Blob = (name: string) =>
    JSON.stringify({
      ...createEmptyAppState(),
      version: 1,
      sets: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name,
          description: '',
          tags: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          goalDate: null,
        },
      ],
    })

  it('uses the v2 key', () => {
    expect(STORAGE_KEY).toBe('seshat:app-state:v2')
    expect(LEGACY_STORAGE_KEY).toBe('seshat:app-state:v1')
  })

  it('runs on v1 when v2 is absent: loads it, and saves back to v1 in v1 form without creating v2', () => {
    window.localStorage.setItem(LEGACY_STORAGE_KEY, v1Blob('Old'))
    const loaded = loadState()
    expect(loaded.ok && loaded.value.sets[0]?.name).toBe('Old')
    expect(loaded.ok && loaded.value.version).toBe(2)
    expect(saveState(loaded.ok ? { ...loaded.value, sets: [] } : createEmptyAppState()).ok).toBe(true)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(JSON.parse(window.localStorage.getItem(LEGACY_STORAGE_KEY) ?? '{}')).toMatchObject({
      version: 1,
      sets: [],
    })
  })

  it('prefers a valid v2 over v1, and falls back to v1 when v2 is corrupt', () => {
    window.localStorage.setItem(LEGACY_STORAGE_KEY, v1Blob('Old'))
    saveState({ ...createEmptyAppState(), sets: [] })
    const current = loadState()
    expect(current.ok && current.value.sets).toEqual([])
    window.localStorage.setItem(STORAGE_KEY, '{broken')
    const fallback = loadState()
    expect(fallback.ok && fallback.value.sets[0]?.name).toBe('Old')
    // v2 is junk, so a v1-mode save must still work (it only refuses when v2 is VALID).
    expect(saveState(fallback.ok ? fallback.value : createEmptyAppState()).ok).toBe(true)
  })

  it('a stale v1-mode tab refuses to write once another tab has produced a valid v2', () => {
    window.localStorage.setItem(LEGACY_STORAGE_KEY, v1Blob('Old'))
    loadState() // this tab is now on v1
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(createEmptyAppState()))
    const result = saveState(createEmptyAppState())
    expect(result.ok).toBe(false)
    expect(window.localStorage.getItem(LEGACY_STORAGE_KEY)).toBe(v1Blob('Old'))
  })

  it('reports corruption only when neither key is usable, and clearState removes both', () => {
    window.localStorage.setItem(LEGACY_STORAGE_KEY, '{nope')
    expect(loadState().ok).toBe(false)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(createEmptyAppState()))
    clearState()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull()
  })

  it('subscribers adopt v2 when another tab finishes migrating, and follow v1 writes only while on v1', () => {
    window.localStorage.setItem(LEGACY_STORAGE_KEY, v1Blob('Old'))
    loadState()
    const seen: string[] = []
    const stop = subscribeToAppState((state) => seen.push(state.sets[0]?.name ?? '(none)'))
    window.dispatchEvent(new StorageEvent('storage', { key: LEGACY_STORAGE_KEY, newValue: v1Blob('Edited') }))
    window.dispatchEvent(new StorageEvent('storage', { key: LEGACY_STORAGE_KEY, newValue: '{bad' }))
    expect(seen).toEqual(['Edited'])
    window.dispatchEvent(
      new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(createEmptyAppState()) }),
    )
    expect(seen).toEqual(['Edited', '(none)'])
    // now on v2: further v1 events are ignored
    window.dispatchEvent(new StorageEvent('storage', { key: LEGACY_STORAGE_KEY, newValue: v1Blob('Late') }))
    expect(seen).toEqual(['Edited', '(none)'])
    stop()
  })

  it('an external-write notification on the v1 key path re-reads storage', () => {
    window.localStorage.setItem(LEGACY_STORAGE_KEY, v1Blob('Old'))
    loadState()
    const seen: string[] = []
    const stop = subscribeToAppState((state) => seen.push(state.sets[0]?.name ?? '(none)'))
    window.dispatchEvent(new Event('seshat:external-write'))
    expect(seen.length).toBeGreaterThan(0)
    stop()
  })
})
