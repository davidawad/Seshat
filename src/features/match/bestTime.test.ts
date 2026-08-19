import { beforeEach, describe, expect, it } from 'vitest'
import type { SetId } from '../../types'
import { formatElapsed, getBestTimeMs, recordCompletionTime } from './bestTime'

const setA = 'set-a' as SetId
const setB = 'set-b' as SetId

beforeEach(() => {
  window.localStorage.clear()
})

describe('getBestTimeMs', () => {
  it('returns null when nothing is stored yet', () => {
    expect(getBestTimeMs(setA, 8)).toBeNull()
  })

  it('returns the stored value after a completion is recorded', () => {
    recordCompletionTime(setA, 8, 5000)
    expect(getBestTimeMs(setA, 8)).toBe(5000)
  })

  it('is scoped per set', () => {
    recordCompletionTime(setA, 8, 5000)
    expect(getBestTimeMs(setB, 8)).toBeNull()
  })

  it('is scoped per round size — a smaller round does not share a record with a larger one', () => {
    recordCompletionTime(setA, 16, 5000)
    expect(getBestTimeMs(setA, 6)).toBeNull()
  })
})

describe('recordCompletionTime', () => {
  it('sets the first recorded time as the best', () => {
    expect(recordCompletionTime(setA, 8, 8000)).toBe(8000)
    expect(getBestTimeMs(setA, 8)).toBe(8000)
  })

  it('replaces the best when a faster time is recorded', () => {
    recordCompletionTime(setA, 8, 8000)
    expect(recordCompletionTime(setA, 8, 6000)).toBe(6000)
    expect(getBestTimeMs(setA, 8)).toBe(6000)
  })

  it('keeps the existing best when a slower time is recorded', () => {
    recordCompletionTime(setA, 8, 6000)
    expect(recordCompletionTime(setA, 8, 9000)).toBe(6000)
    expect(getBestTimeMs(setA, 8)).toBe(6000)
  })

  it('treats an equal time as not beating the record', () => {
    recordCompletionTime(setA, 8, 6000)
    expect(recordCompletionTime(setA, 8, 6000)).toBe(6000)
  })

  it('does not let a faster small-round time overwrite a larger round’s record', () => {
    recordCompletionTime(setA, 16, 24000)
    recordCompletionTime(setA, 6, 10000)
    expect(getBestTimeMs(setA, 16)).toBe(24000)
    expect(getBestTimeMs(setA, 6)).toBe(10000)
  })
})

describe('formatElapsed', () => {
  it('formats milliseconds as seconds with one decimal place', () => {
    expect(formatElapsed(12345)).toBe('12.3s')
    expect(formatElapsed(500)).toBe('0.5s')
    expect(formatElapsed(0)).toBe('0.0s')
  })
})
