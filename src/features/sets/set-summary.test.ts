import { describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import type { CardId, SetId, StudyCard } from '../../types'
import { summarizeMastery } from './set-summary'

const now = new Date('2026-01-10T00:00:00.000Z')

const makeCard = (
  id: string,
  overrides: Partial<Pick<StudyCard['scheduling'], 'due' | 'state' | 'lastReview'>> = {},
): StudyCard => ({
  id: id as CardId,
  setId: 's1' as SetId,
  prompt: 'prompt',
  content: { kind: 'short-answer', answer: 'answer', acceptableAnswers: [] },
  explanation: null,
  sourceRef: null,
  tags: [],
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  scheduling: { ...createInitialScheduling(now), ...overrides },
})

describe('summarizeMastery', () => {
  it('reports a fresh (never-studied) set entirely under newCount, not due', () => {
    // A New card is due by construction (createInitialScheduling seeds `due`
    // at creation time) — counting it under both `due` and `newCount` would
    // double-count the same cards under two separate summary labels.
    const cards = [makeCard('c1'), makeCard('c2'), makeCard('c3')]
    const summary = summarizeMastery(cards, now)
    expect(summary.total).toBe(3)
    expect(summary.due).toBe(0)
    expect(summary.newCount).toBe(3)
    expect(summary.lastStudied).toBeNull()
  })

  it('counts a previously-studied, due-again card under due, not newCount', () => {
    const cards = [
      makeCard('c1', {
        state: 'Review',
        lastReview: now.toISOString(),
        due: new Date(now.getTime() - 1000).toISOString(),
      }),
      makeCard('c2'),
    ]
    const summary = summarizeMastery(cards, now)
    expect(summary.due).toBe(1)
    expect(summary.newCount).toBe(1)
  })

  it('excludes not-yet-due, previously-studied cards from the due count', () => {
    const cards = [
      makeCard('c1', {
        state: 'Review',
        lastReview: now.toISOString(),
        due: new Date(now.getTime() - 1000).toISOString(),
      }),
      makeCard('c2', {
        state: 'Review',
        lastReview: now.toISOString(),
        due: new Date(now.getTime() + 60_000).toISOString(),
      }),
    ]
    expect(summarizeMastery(cards, now).due).toBe(1)
  })

  it('excludes reviewed cards from the new count', () => {
    const cards = [makeCard('c1', { state: 'Review', lastReview: now.toISOString() }), makeCard('c2')]
    expect(summarizeMastery(cards, now).newCount).toBe(1)
  })

  it('reports the most recent lastReview across all cards', () => {
    const earlier = new Date(now.getTime() - 86_400_000).toISOString()
    const later = new Date(now.getTime() - 1000).toISOString()
    const cards = [
      makeCard('c1', { state: 'Review', lastReview: earlier }),
      makeCard('c2', { state: 'Review', lastReview: later }),
    ]
    expect(summarizeMastery(cards, now).lastStudied).toEqual(new Date(later))
  })

  it('handles an empty set', () => {
    expect(summarizeMastery([], now)).toEqual({ total: 0, due: 0, newCount: 0, lastStudied: null })
  })
})
