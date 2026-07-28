import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyAppState } from '../types'
import { STORAGE_KEY, loadState, saveState } from './storage'

describe('storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns an empty state when nothing is persisted yet', () => {
    const result = loadState()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.decks).toEqual([])
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, decks: 'not-an-array' }))
    const result = loadState()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('corrupt')
  })
})
