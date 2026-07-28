import { beforeEach, describe, expect, it } from 'vitest'
import type { DeckId } from '../../types'
import { formatElapsed, getBestTimeMs, recordCompletionTime } from './bestTime'

const deckA = 'deck-a' as DeckId
const deckB = 'deck-b' as DeckId

beforeEach(() => {
  window.localStorage.clear()
})

describe('getBestTimeMs', () => {
  it('returns null when nothing is stored yet', () => {
    expect(getBestTimeMs(deckA)).toBeNull()
  })

  it('returns the stored value after a completion is recorded', () => {
    recordCompletionTime(deckA, 5000)
    expect(getBestTimeMs(deckA)).toBe(5000)
  })

  it('is scoped per deck', () => {
    recordCompletionTime(deckA, 5000)
    expect(getBestTimeMs(deckB)).toBeNull()
  })
})

describe('recordCompletionTime', () => {
  it('sets the first recorded time as the best', () => {
    expect(recordCompletionTime(deckA, 8000)).toBe(8000)
    expect(getBestTimeMs(deckA)).toBe(8000)
  })

  it('replaces the best when a faster time is recorded', () => {
    recordCompletionTime(deckA, 8000)
    expect(recordCompletionTime(deckA, 6000)).toBe(6000)
    expect(getBestTimeMs(deckA)).toBe(6000)
  })

  it('keeps the existing best when a slower time is recorded', () => {
    recordCompletionTime(deckA, 6000)
    expect(recordCompletionTime(deckA, 9000)).toBe(6000)
    expect(getBestTimeMs(deckA)).toBe(6000)
  })

  it('treats an equal time as not beating the record', () => {
    recordCompletionTime(deckA, 6000)
    expect(recordCompletionTime(deckA, 6000)).toBe(6000)
  })
})

describe('formatElapsed', () => {
  it('formats milliseconds as seconds with one decimal place', () => {
    expect(formatElapsed(12345)).toBe('12.3s')
    expect(formatElapsed(500)).toBe('0.5s')
    expect(formatElapsed(0)).toBe('0.0s')
  })
})
