import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  KEYBINDINGS_STORAGE_KEY,
  loadKeybindingOverrides,
  saveKeybindingOverrides,
  subscribeToKeybindingOverrides,
} from './keybindingStorage'
import { clearMirrors } from './persistence'

describe('keybindingStorage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    clearMirrors()
  })

  describe('cookie mirror', () => {
    it('falls back to the mirrored overrides when localStorage has none', () => {
      saveKeybindingOverrides({ 'flashcards.flip': 'Enter' })
      window.localStorage.clear()
      expect(loadKeybindingOverrides()).toEqual({ 'flashcards.flip': 'Enter' })
    })

    it('prefers localStorage over the mirror, even when it is corrupt', () => {
      saveKeybindingOverrides({ 'flashcards.flip': 'Enter' })
      window.localStorage.setItem(KEYBINDINGS_STORAGE_KEY, '{not valid json')
      expect(loadKeybindingOverrides()).toEqual({})
    })
  })

  it('notifies subscribers when another tab changes the overrides', () => {
    const onChange = vi.fn()
    const stop = subscribeToKeybindingOverrides(onChange)
    window.localStorage.setItem(KEYBINDINGS_STORAGE_KEY, JSON.stringify({ 'flashcards.flip': 'Enter' }))
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: KEYBINDINGS_STORAGE_KEY,
        newValue: JSON.stringify({ 'flashcards.flip': 'Enter' }),
      }),
    )
    expect(onChange).toHaveBeenCalledWith({ 'flashcards.flip': 'Enter' })
    stop()
  })

  it('returns {} when nothing has been saved', () => {
    expect(loadKeybindingOverrides()).toEqual({})
  })

  it('round-trips saved overrides through load', () => {
    saveKeybindingOverrides({ 'flashcards.flip': 'Enter' })
    expect(loadKeybindingOverrides()).toEqual({ 'flashcards.flip': 'Enter' })
  })

  it('returns {} for corrupt (non-JSON) stored data', () => {
    window.localStorage.setItem('seshat:keybindings:v1', '{not valid json')
    expect(loadKeybindingOverrides()).toEqual({})
  })

  it('drops unknown action ids found in storage rather than surfacing them', () => {
    window.localStorage.setItem('seshat:keybindings:v1', JSON.stringify({ 'not.a.real.action': '1' }))
    expect(loadKeybindingOverrides()).toEqual({})
  })

  it('canonicalizes a raw key string found in storage', () => {
    window.localStorage.setItem('seshat:keybindings:v1', JSON.stringify({ 'flashcards.flip': 'enter' }))
    expect(loadKeybindingOverrides()).toEqual({ 'flashcards.flip': 'Enter' })
  })

  describe('storage failures are swallowed, never thrown', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('saveKeybindingOverrides does not throw when localStorage.setItem throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      })
      expect(() => saveKeybindingOverrides({ 'flashcards.flip': 'Enter' })).not.toThrow()
    })

    it('loadKeybindingOverrides returns {} (not throw) when localStorage.getItem throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage unavailable')
      })
      expect(loadKeybindingOverrides()).toEqual({})
    })
  })
})
