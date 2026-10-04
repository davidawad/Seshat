import { describe, expect, it } from 'vitest'
import type { CardId, ReviewLogEntry, SetId } from '../../types'
import { calibrationBuckets, hasConfidenceData } from './calibration'

const makeEntry = (confidence: ReviewLogEntry['confidence']): ReviewLogEntry => ({
  cardId: 'c1' as CardId,
  setId: 'd1' as SetId,
  reviewedAt: '2026-01-10T12:00:00.000Z',
  grade: 'good',
  confidence,
  correct: true,
  retrievabilityAtReview: null,
  elapsedMs: 1000,
  selfExplanation: null,
})

describe('hasConfidenceData', () => {
  it('is false for an empty log and for entries logged without a confidence rating', () => {
    expect(hasConfidenceData([])).toBe(false)
    expect(hasConfidenceData([makeEntry(null), makeEntry(null)])).toBe(false)
  })

  it('is true once any entry has a rating; null entries do not count in the buckets', () => {
    const log = [makeEntry(null), makeEntry('sure')]
    expect(hasConfidenceData(log)).toBe(true)
    expect(calibrationBuckets(log).reduce((sum, bucket) => sum + bucket.total, 0)).toBe(1)
  })
})
