import { describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import type { CardId, ReviewLogEntry, SetId, StudyCard } from '../../types'
import { folderSetIds, scopeToSets, summarizeScope } from './scope'

const now = new Date('2026-01-10T12:00:00.000Z')
const A = 'a1111111-1111-4111-8111-111111111111' as SetId
const B = 'b1111111-1111-4111-8111-111111111111' as SetId

const card = (id: string, setId: SetId, state: 'New' | 'Review', dueOffsetMs: number): StudyCard => ({
  id: id as CardId,
  setId,
  prompt: 'p',
  promptImage: null,
  content: { kind: 'short-answer', answer: 'a', acceptableAnswers: [], answerImage: null },
  explanation: null,
  sourceRef: null,
  tags: [],
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  scheduling: { ...createInitialScheduling(now), state, due: new Date(now.getTime() + dueOffsetMs).toISOString() },
})

const entry = (setId: SetId, correct: boolean): ReviewLogEntry => ({
  cardId: 'c1111111-1111-4111-8111-111111111111' as CardId,
  setId,
  reviewedAt: now.toISOString(),
  grade: correct ? 'good' : 'again',
  confidence: null,
  correct,
  retrievabilityAtReview: null,
  elapsedMs: 1000,
  selfExplanation: null,
})

const state = {
  cards: [card('c1', A, 'Review', -1000), card('c2', A, 'New', -1000), card('c3', B, 'Review', 1000)],
  reviewLog: [entry(A, true), entry(A, false), entry(B, true)],
}

describe('per-scope stats', () => {
  it('summarizes one set without counting the others', () => {
    const summary = summarizeScope(scopeToSets(state, new Set([A])), now)
    expect(summary).toMatchObject({ cardCount: 2, due: 1, newCount: 1, reviewsTotal: 2, correctRate: 0.5 })
  })

  it('summarizes several sets (a folder) together', () => {
    const summary = summarizeScope(scopeToSets(state, folderSetIds({ setIds: [A, B] })), now)
    expect(summary).toMatchObject({ cardCount: 3, due: 1, reviewsTotal: 3 })
    expect(summary.correctRate).toBeCloseTo(2 / 3)
  })

  it('has no rates before any review', () => {
    const summary = summarizeScope(scopeToSets(state, new Set()), now)
    expect(summary).toMatchObject({ cardCount: 0, correctRate: null, retention: null })
  })
})
