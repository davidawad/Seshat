import { describe, expect, it } from 'vitest'
import type { CardId, SetId, ShortAnswerContent, StudyCard } from '../../../types'
import { MIN_CARDS, OPTION_COUNT, buildQuestions } from './round'

// Branded IDs are just strings at runtime (the brand is a compile-time-only
// phantom field), and buildQuestions never parses them through the zod
// schema — so plain fixture strings cast to the branded type are fine here.
const setId = 'set-fixture' as SetId

let counter = 0
const cardId = (): CardId => {
  counter += 1
  return `card-fixture-${counter}` as CardId
}

const makeCard = (term: string, definition: string): StudyCard => {
  const content: ShortAnswerContent = { kind: 'short-answer', answer: definition, acceptableAnswers: [] }
  return {
    id: cardId(),
    setId,
    prompt: term,
    content,
    explanation: null,
    sourceRef: null,
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    scheduling: {
      due: '2026-01-01T00:00:00.000Z',
      stability: 0,
      difficulty: 0,
      scheduledDays: 0,
      learningSteps: 0,
      reps: 0,
      lapses: 0,
      state: 'New',
      lastReview: null,
    },
  }
}

const makeCards = (n: number): StudyCard[] =>
  Array.from({ length: n }, (_, i) => makeCard(`Term ${i}`, `Definition ${i}`))

/** A deterministic pseudo-random source for tests: cycles through a fixed sequence in [0, 1). */
const sequence = (...values: number[]): (() => number) => {
  let i = 0
  return () => {
    const value = values[i % values.length]!
    i += 1
    return value
  }
}

describe('buildQuestions', () => {
  it('produces exactly one question per card', () => {
    const cards = makeCards(6)
    const questions = buildQuestions(cards, Math.random)
    expect(questions).toHaveLength(6)
    expect(new Set(questions.map((q) => q.cardId))).toEqual(new Set(cards.map((c) => c.id)))
  })

  it('every question includes its correct option among its options', () => {
    const cards = makeCards(6)
    const questions = buildQuestions(cards, Math.random)
    for (const question of questions) {
      expect(question.options).toContain(question.correctOption)
    }
  })

  it('offers up to OPTION_COUNT options, with no duplicates', () => {
    const cards = makeCards(10)
    const questions = buildQuestions(cards, Math.random)
    for (const question of questions) {
      expect(question.options.length).toBeLessThanOrEqual(OPTION_COUNT)
      expect(question.options.length).toBeGreaterThanOrEqual(2) // correct answer + at least one decoy
      expect(new Set(question.options).size).toBe(question.options.length)
    }
  })

  it('prompt and correct option always come from the same card (front paired with back, or vice versa)', () => {
    const cards = makeCards(6)
    const questions = buildQuestions(cards, Math.random)
    for (const question of questions) {
      const card = cards.find((c) => c.id === question.cardId)!
      const term = card.prompt
      const definition = (card.content as ShortAnswerContent).answer
      const isTermPrompt = question.prompt === term && question.correctOption === definition
      const isDefinitionPrompt = question.prompt === definition && question.correctOption === term
      expect(isTermPrompt || isDefinitionPrompt).toBe(true)
    }
  })

  it('is deterministic for a fixed random source', () => {
    const cards = makeCards(8)
    const random = sequence(0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.05, 0.15, 0.25)
    const a = buildQuestions(cards, random)
    const random2 = sequence(0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.05, 0.15, 0.25)
    const b = buildQuestions(cards, random2)
    expect(a).toEqual(b)
  })

  it('returns nothing for an empty set', () => {
    expect(buildQuestions([], Math.random)).toEqual([])
  })

  it('falls back to fewer decoys when the set cannot supply OPTION_COUNT - 1 distinct ones', () => {
    // MIN_CARDS is the minimum this game mode is offered at; below that,
    // decoys can still be built (just fewer than OPTION_COUNT - 1).
    const cards = makeCards(MIN_CARDS - 1)
    const questions = buildQuestions(cards, Math.random)
    expect(questions).toHaveLength(MIN_CARDS - 1)
    for (const question of questions) {
      expect(question.options.length).toBeLessThan(OPTION_COUNT)
    }
  })
})
