import { describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import type { CardId, DeckId, ReviewLogEntry, StudyCard } from '../../types'
import { calibrationBuckets, dueBacklogCount, retentionEstimate, reviewedTodayCount } from './calibration'

const now = new Date('2026-01-10T12:00:00.000Z')

const makeEntry = (overrides: Partial<ReviewLogEntry> = {}): ReviewLogEntry => ({
  cardId: 'c1' as CardId,
  deckId: 'd1' as DeckId,
  reviewedAt: now.toISOString(),
  grade: 'good',
  confidence: 'sure',
  correct: true,
  retrievabilityAtReview: null,
  elapsedMs: 1000,
  ...overrides,
})

const makeCard = (dueOffsetMs: number): StudyCard => ({
  id: 'c1' as CardId,
  deckId: 'd1' as DeckId,
  prompt: 'p',
  content: { kind: 'short-answer', answer: 'a', acceptableAnswers: [] },
  explanation: null,
  sourceRef: null,
  tags: [],
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  scheduling: { ...createInitialScheduling(now), due: new Date(now.getTime() + dueOffsetMs).toISOString() },
})

describe('calibrationBuckets', () => {
  it('computes correct-rate per confidence bucket', () => {
    const log: ReviewLogEntry[] = [
      makeEntry({ confidence: 'sure', correct: true }),
      makeEntry({ confidence: 'sure', correct: false }),
      makeEntry({ confidence: 'guessed', correct: true }),
    ]
    const buckets = calibrationBuckets(log)
    const sure = buckets.find((b) => b.confidence === 'sure')
    const guessed = buckets.find((b) => b.confidence === 'guessed')
    const unsure = buckets.find((b) => b.confidence === 'unsure')
    expect(sure).toEqual({ confidence: 'sure', total: 2, correct: 1, correctRate: 0.5 })
    expect(guessed).toEqual({ confidence: 'guessed', total: 1, correct: 1, correctRate: 1 })
    expect(unsure).toEqual({ confidence: 'unsure', total: 0, correct: 0, correctRate: null })
  })

  it('ignores entries with null confidence', () => {
    const log: ReviewLogEntry[] = [makeEntry({ confidence: null, correct: true })]
    const buckets = calibrationBuckets(log)
    expect(buckets.every((b) => b.total === 0)).toBe(true)
  })
})

describe('dueBacklogCount', () => {
  it('counts only due cards', () => {
    const cards = [makeCard(-1000), makeCard(1000)]
    expect(dueBacklogCount(cards, now)).toBe(1)
  })
})

describe('reviewedTodayCount', () => {
  it('counts reviews since local midnight', () => {
    const log: ReviewLogEntry[] = [
      makeEntry({ reviewedAt: now.toISOString() }),
      makeEntry({ reviewedAt: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString() }),
    ]
    expect(reviewedTodayCount(log, now)).toBe(1)
  })
})

describe('retentionEstimate', () => {
  it('returns null with no history', () => {
    expect(retentionEstimate([])).toBeNull()
  })

  it('averages retrievabilityAtReview when available', () => {
    const log: ReviewLogEntry[] = [
      makeEntry({ retrievabilityAtReview: 0.9 }),
      makeEntry({ retrievabilityAtReview: 0.7 }),
    ]
    expect(retentionEstimate(log)).toBeCloseTo(0.8)
  })

  it('falls back to recent correct-rate when no retrievability data exists', () => {
    const log: ReviewLogEntry[] = [
      makeEntry({ retrievabilityAtReview: null, correct: true }),
      makeEntry({ retrievabilityAtReview: null, correct: false }),
    ]
    expect(retentionEstimate(log)).toBe(0.5)
  })

  it('only considers the most recent sampleSize entries', () => {
    const log: ReviewLogEntry[] = [
      makeEntry({ retrievabilityAtReview: null, correct: false }),
      makeEntry({ retrievabilityAtReview: null, correct: true }),
      makeEntry({ retrievabilityAtReview: null, correct: true }),
    ]
    expect(retentionEstimate(log, 2)).toBe(1)
  })
})
