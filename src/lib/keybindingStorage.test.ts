import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadKeybindingOverrides, saveKeybindingOverrides } from './keybindingStorage'

describe('keybindingStorage', () => {
  beforeEach(() => {
    window.localStorage.clear()
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
