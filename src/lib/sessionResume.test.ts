import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { SetId } from '../types'
import { clearResumeState, loadResumeState, saveResumeState } from './sessionResume'

const setIdA = 'a1111111-1111-4111-8111-111111111111' as SetId
const setIdB = 'b2222222-2222-4222-8222-222222222222' as SetId

const schema = z.object({
  position: z.number().int().nonnegative(),
  ids: z.array(z.string()),
})

describe('sessionResume', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('round-trips saved data through load', () => {
    const data = { position: 2, ids: ['x', 'y'] }
    saveResumeState('study', setIdA, data)
    expect(loadResumeState('study', setIdA, schema)).toEqual(data)
  })

  it('returns null when nothing has been saved', () => {
    expect(loadResumeState('study', setIdA, schema)).toBeNull()
  })

  it('returns null for corrupt (non-JSON) stored data', () => {
    window.localStorage.setItem('seshat:session-resume:study:' + setIdA, '{not valid json')
    expect(loadResumeState('study', setIdA, schema)).toBeNull()
  })

  it('returns null when stored data fails schema validation', () => {
    saveResumeState('study', setIdA, { position: -1, ids: 'not-an-array' })
    expect(loadResumeState('study', setIdA, schema)).toBeNull()
  })

  it('clears stored data so a subsequent load returns null', () => {
    saveResumeState('study', setIdA, { position: 1, ids: [] })
    clearResumeState('study', setIdA)
    expect(loadResumeState('study', setIdA, schema)).toBeNull()
  })

  it('scopes storage by mode, so the same set under a different mode is independent', () => {
    saveResumeState('study', setIdA, { position: 3, ids: ['a'] })
    saveResumeState('flashcards', setIdA, { position: 7, ids: ['b'] })
    expect(loadResumeState('study', setIdA, schema)).toEqual({ position: 3, ids: ['a'] })
    expect(loadResumeState('flashcards', setIdA, schema)).toEqual({ position: 7, ids: ['b'] })
  })

  it('scopes storage by setId, so two sets in the same mode are independent', () => {
    saveResumeState('study', setIdA, { position: 3, ids: ['a'] })
    saveResumeState('study', setIdB, { position: 9, ids: ['b'] })
    expect(loadResumeState('study', setIdA, schema)).toEqual({ position: 3, ids: ['a'] })
    expect(loadResumeState('study', setIdB, schema)).toEqual({ position: 9, ids: ['b'] })
  })

  it('clearing one mode/set does not disturb another', () => {
    saveResumeState('study', setIdA, { position: 3, ids: ['a'] })
    saveResumeState('flashcards', setIdA, { position: 7, ids: ['b'] })
    clearResumeState('study', setIdA)
    expect(loadResumeState('study', setIdA, schema)).toBeNull()
    expect(loadResumeState('flashcards', setIdA, schema)).toEqual({ position: 7, ids: ['b'] })
  })

  describe('storage failures are swallowed, never thrown', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('saveResumeState does not throw when localStorage.setItem throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('quota exceeded', 'QuotaExceededError')
      })
      expect(() => saveResumeState('study', setIdA, { position: 1, ids: [] })).not.toThrow()
    })

    it('loadResumeState returns null (not throw) when localStorage.getItem throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage unavailable')
      })
      expect(loadResumeState('study', setIdA, schema)).toBeNull()
    })

    it('clearResumeState does not throw when localStorage.removeItem throws', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('storage unavailable')
      })
      expect(() => clearResumeState('study', setIdA)).not.toThrow()
    })
  })
})
