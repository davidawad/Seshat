import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, createEmptyAppState } from '../types'
import { clearMirrors, resetPersistenceRequestForTests } from './persistence'
import { STORAGE_KEY, clearState, loadInitialState, loadState, saveState, subscribeToAppState } from './storage'

describe('storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    clearMirrors()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns an empty state when nothing is persisted yet', () => {
    const result = loadState()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.sets).toEqual([])
  })

  it('round-trips a saved state', () => {
    const state = createEmptyAppState()
    expect(saveState(state).ok).toBe(true)
    const result = loadState()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toEqual(state)
  })

  it('reports corruption instead of throwing on invalid JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not valid json')
    const result = loadState()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('corrupt')
  })

  it('reports corruption when the persisted shape fails schema validation', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, sets: 'not-an-array' }))
    const result = loadState()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('corrupt')
  })

  describe('cookie mirror', () => {
    const darkState = () => ({ ...createEmptyAppState(), settings: { ...DEFAULT_SETTINGS, theme: 'dark' as const } })

    it('hydrates settings (only) from the cookie when localStorage has no app state', () => {
      saveState(darkState())
      window.localStorage.clear()
      const result = loadState()
      expect(result.ok && result.value.settings.theme).toBe('dark')
      expect(result.ok && result.value.sets).toEqual([])
    })

    it('never puts sets or cards in the cookie', () => {
      saveState({ ...darkState(), sets: [] })
      expect(document.cookie).not.toContain('sets')
    })

    it('keeps mirrored settings when localStorage is corrupt (loadInitialState)', () => {
      saveState(darkState())
      window.localStorage.setItem(STORAGE_KEY, '{not valid json')
      expect(loadState().ok).toBe(false)
      expect(loadInitialState().settings.theme).toBe('dark')
    })

    it('keeps mirrored settings when localStorage is unavailable', () => {
      saveState(darkState())
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('denied')
      })
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('denied')
      })
      const result = loadState()
      expect(!result.ok && result.error.kind).toBe('unavailable')
      expect(loadInitialState().settings.theme).toBe('dark')
      expect(saveState(darkState()).ok).toBe(false)
    })

    it('falls back to defaults when there is neither storage nor a valid cookie', () => {
      expect(loadInitialState()).toEqual(createEmptyAppState())
    })

    it('prefers localStorage over the cookie when both exist', () => {
      saveState(darkState())
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...createEmptyAppState(), settings: { ...DEFAULT_SETTINGS, theme: 'light' } }),
      )
      expect(loadInitialState().settings.theme).toBe('light')
    })
  })

  it('requests persistent storage once after a successful save', () => {
    resetPersistenceRequestForTests()
    const persist = vi.fn().mockResolvedValue(true)
    Object.defineProperty(navigator, 'storage', { value: { persist }, configurable: true })
    saveState(createEmptyAppState())
    saveState(createEmptyAppState())
    expect(persist).toHaveBeenCalledTimes(1)
    Reflect.deleteProperty(navigator, 'storage')
  })

  it('does not rewrite localStorage when the serialized state is unchanged', () => {
    saveState(createEmptyAppState())
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    saveState(createEmptyAppState())
    expect(setItem).not.toHaveBeenCalledWith(STORAGE_KEY, expect.anything())
  })

  it('clearState removes the stored blob', () => {
    saveState(createEmptyAppState())
    clearState()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  describe('subscribeToAppState', () => {
    it('hydrates from another tab, ignores invalid data, and stops after unsubscribe', () => {
      const onState = vi.fn()
      const stop = subscribeToAppState(onState)
      const next = { ...createEmptyAppState(), settings: { ...DEFAULT_SETTINGS, theme: 'dark' as const } }
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(next) }))
      expect(onState).toHaveBeenCalledWith(next)
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: '{garbage' }))
      expect(onState).toHaveBeenCalledTimes(1)
      stop()
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(next) }))
      expect(onState).toHaveBeenCalledTimes(1)
    })

    it('reloads from storage on a same-tab external write', () => {
      const onState = vi.fn()
      const stop = subscribeToAppState(onState)
      saveState({ ...createEmptyAppState(), settings: { ...DEFAULT_SETTINGS, theme: 'dark' } })
      window.dispatchEvent(new Event('seshat:external-write'))
      expect(onState.mock.calls[0]?.[0].settings.theme).toBe('dark')
      stop()
    })

    it("does not echo this tab's own saves", () => {
      const onState = vi.fn()
      const stop = subscribeToAppState(onState)
      saveState(createEmptyAppState())
      expect(onState).not.toHaveBeenCalled()
      stop()
    })
  })
})
