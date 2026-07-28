import { describe, expect, it } from 'vitest'
import type { CardId } from '../../types'
import { advanceSession, createFlashcardSession, currentCardId, isSessionComplete } from './session'

const ids = (...values: string[]): CardId[] => values as unknown as CardId[]

describe('createFlashcardSession', () => {
  it('shuffles all given card ids into the session order', () => {
    const cardIds = ids('a', 'b', 'c')
    const session = createFlashcardSession(cardIds, () => 0)
    expect(session.order).toHaveLength(3)
    expect([...session.order].sort()).toEqual([...cardIds].sort())
    expect(session.position).toBe(0)
    expect(session.knownCount).toBe(0)
  })

  it('handles an empty deck', () => {
    const session = createFlashcardSession([])
    expect(session.order).toEqual([])
    expect(isSessionComplete(session)).toBe(true)
  })
})

describe('currentCardId', () => {
  it('returns the id at the current position', () => {
    const session = createFlashcardSession(ids('a', 'b'), () => 0)
    expect(currentCardId(session)).toBe(session.order[0])
  })

  it('returns null once the position runs past the end', () => {
    const session = createFlashcardSession(ids('a'), () => 0)
    const advanced = advanceSession(session, true)
    expect(currentCardId(advanced)).toBeNull()
  })
})

describe('isSessionComplete', () => {
  it('is false while cards remain', () => {
    const session = createFlashcardSession(ids('a', 'b'), () => 0)
    expect(isSessionComplete(session)).toBe(false)
  })

  it('is true once every card has been advanced past', () => {
    let session = createFlashcardSession(ids('a', 'b'), () => 0)
    session = advanceSession(session, true)
    expect(isSessionComplete(session)).toBe(false)
    session = advanceSession(session, false)
    expect(isSessionComplete(session)).toBe(true)
  })
})

describe('advanceSession', () => {
  it('increments position and knownCount together on a Know outcome', () => {
    const session = createFlashcardSession(ids('a', 'b'), () => 0)
    const advanced = advanceSession(session, true)
    expect(advanced.position).toBe(1)
    expect(advanced.knownCount).toBe(1)
  })

  it('increments position but not knownCount on a Don’t-know outcome', () => {
    const session = createFlashcardSession(ids('a', 'b'), () => 0)
    const advanced = advanceSession(session, false)
    expect(advanced.position).toBe(1)
    expect(advanced.knownCount).toBe(0)
  })

  it('does not mutate the original session', () => {
    const session = createFlashcardSession(ids('a', 'b'), () => 0)
    advanceSession(session, true)
    expect(session.position).toBe(0)
    expect(session.knownCount).toBe(0)
  })
})
