import { describe, expect, it } from 'vitest'
import type { CardId, DeckId, ShortAnswerContent, StudyCard } from '../../types'
import { MAX_TEST_QUESTIONS, type TestQuestion, generateTest, shuffle } from './generate-test'

// Branded IDs are just strings at runtime (the brand is a compile-time-only
// phantom field), and generateTest never parses them through the zod schema
// — so plain fixture strings cast to the branded type are fine here.
const deckId = 'deck-fixture' as DeckId

let counter = 0
const cardId = (): CardId => {
  counter += 1
  return `card-fixture-${counter}` as CardId
}

const makeCard = (term: string, definition: string): StudyCard => {
  const content: ShortAnswerContent = { kind: 'short-answer', answer: definition, acceptableAnswers: [] }
  return {
    id: cardId(),
    deckId,
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

describe('shuffle', () => {
  it('is the identity permutation when random always returns just under 1 (j always equals i)', () => {
    // Fisher-Yates from i = length-1 downto 1, j = floor(random() * (i+1)).
    // random() -> 0.999999 makes floor(random * (i+1)) === i at every step,
    // so every swap is a same-index no-op and the order is preserved.
    expect(shuffle([1, 2, 3, 4], () => 0.999999)).toEqual([1, 2, 3, 4])
  })

  it('produces a known permutation for a fixed random sequence', () => {
    // random() -> 0 makes j = 0 at every step, rotating each element into
    // position 0 as i counts down: [1,2,3,4] -> [2,3,4,1].
    const result = shuffle([1, 2, 3, 4], sequence(0, 0, 0))
    expect(result).toEqual([2, 3, 4, 1])
  })

  it('does not mutate the input array', () => {
    const input = [1, 2, 3]
    const output = shuffle(input, sequence(0.9, 0.1, 0.5))
    expect(input).toEqual([1, 2, 3])
    expect(output).not.toBe(input)
  })

  it('is not hardcoded to always the same order (varies with the random source)', () => {
    const a = shuffle([1, 2, 3, 4, 5], sequence(0, 0, 0, 0))
    const b = shuffle([1, 2, 3, 4, 5], sequence(0.99, 0.99, 0.99, 0.99))
    expect(a).not.toEqual(b)
  })
})

describe('generateTest', () => {
  it('returns an empty array for an empty deck', () => {
    expect(generateTest([])).toEqual([])
  })

  it('falls back to written-only for a deck too small for true/false (< 2 cards)', () => {
    const cards = makeCards(1)
    const questions = generateTest(cards)
    expect(questions).toHaveLength(1)
    expect(questions.every((q) => q.format === 'written')).toBe(true)
  })

  it('falls back to written-only for a deck too small for multiple-choice but big enough for true/false', () => {
    const cards = makeCards(3)
    const questions = generateTest(cards, sequence(0.4))
    // canTrueFalse (>=2) is true, canMultipleChoice (>=4) is false, so the
    // format cycle is [written, true-false] only — never multiple-choice.
    expect(questions).toHaveLength(3)
    expect(questions.some((q) => q.format === 'multiple-choice')).toBe(false)
  })

  it('one question per card, up to the cap, for decks at or under the cap', () => {
    const cards = makeCards(7)
    const questions = generateTest(cards)
    expect(questions).toHaveLength(7)
    expect(new Set(questions.map((q) => q.cardId)).size).toBe(7)
  })

  it('caps at MAX_TEST_QUESTIONS for a larger deck, still one question per selected card', () => {
    const cards = makeCards(MAX_TEST_QUESTIONS + 5)
    const questions = generateTest(cards)
    expect(questions).toHaveLength(MAX_TEST_QUESTIONS)
    expect(new Set(questions.map((q) => q.cardId)).size).toBe(MAX_TEST_QUESTIONS)
  })

  it('distributes formats roughly evenly (round-robin) once all three are viable', () => {
    const cards = makeCards(9)
    const questions = generateTest(cards)
    const counts = { written: 0, 'true-false': 0, 'multiple-choice': 0 }
    for (const q of questions) counts[q.format] += 1
    expect(counts.written).toBe(3)
    expect(counts['true-false']).toBe(3)
    expect(counts['multiple-choice']).toBe(3)
  })

  it('shuffles question order rather than always following card order', () => {
    const cards = makeCards(10)
    const a = generateTest(cards, sequence(0, 0.9, 0.2, 0.7, 0.1, 0.5, 0.3, 0.8, 0.05, 0.65))
    const b = generateTest(cards, sequence(0.9, 0, 0.7, 0.2, 0.5, 0.1, 0.8, 0.3, 0.65, 0.05))
    const orderA = a.map((q) => q.cardId)
    const orderB = b.map((q) => q.cardId)
    expect(orderA).not.toEqual(orderB)
    // Same underlying card set either way.
    expect(new Set(orderA)).toEqual(new Set(orderB))
  })

  describe('true/false questions', () => {
    it('claims are sometimes true and sometimes false across many cards', () => {
      const cards = makeCards(20)
      const questions = generateTest(cards).filter(
        (q): q is Extract<TestQuestion, { format: 'true-false' }> => q.format === 'true-false',
      )
      expect(questions.length).toBeGreaterThan(0)
      expect(questions.some((q) => q.claimIsTrue)).toBe(true)
      expect(questions.some((q) => !q.claimIsTrue)).toBe(true)
    })

    it('a false claim never coincidentally equals the real answer', () => {
      const cards = makeCards(20)
      for (let trial = 0; trial < 5; trial++) {
        const questions = generateTest(cards).filter(
          (q): q is Extract<TestQuestion, { format: 'true-false' }> => q.format === 'true-false',
        )
        for (const q of questions) {
          if (!q.claimIsTrue) {
            const card = cards.find((c) => c.id === q.cardId)!
            const realAnswer = (card.content as ShortAnswerContent).answer
            expect(q.claimedAnswer).not.toBe(realAnswer)
          }
        }
      }
    })

    it('a true claim always shows the real answer', () => {
      const cards = makeCards(20)
      const questions = generateTest(cards).filter(
        (q): q is Extract<TestQuestion, { format: 'true-false' }> => q.format === 'true-false',
      )
      for (const q of questions) {
        if (q.claimIsTrue) {
          const card = cards.find((c) => c.id === q.cardId)!
          expect(q.claimedAnswer).toBe((card.content as ShortAnswerContent).answer)
        }
      }
    })
  })

  describe('multiple-choice questions', () => {
    it('includes the real answer among the options', () => {
      const cards = makeCards(20)
      const questions = generateTest(cards).filter(
        (q): q is Extract<TestQuestion, { format: 'multiple-choice' }> => q.format === 'multiple-choice',
      )
      expect(questions.length).toBeGreaterThan(0)
      for (const q of questions) {
        expect(q.options).toContain(q.correctOption)
      }
    })

    it('has up to 4 unique options with no duplicates', () => {
      const cards = makeCards(20)
      const questions = generateTest(cards).filter(
        (q): q is Extract<TestQuestion, { format: 'multiple-choice' }> => q.format === 'multiple-choice',
      )
      for (const q of questions) {
        expect(q.options.length).toBeLessThanOrEqual(4)
        expect(new Set(q.options).size).toBe(q.options.length)
      }
    })

    it('distractors are never equal to the real answer', () => {
      const cards = makeCards(20)
      const questions = generateTest(cards).filter(
        (q): q is Extract<TestQuestion, { format: 'multiple-choice' }> => q.format === 'multiple-choice',
      )
      for (const q of questions) {
        const distractors = q.options.filter((option) => option !== q.correctOption)
        expect(distractors.every((d) => d !== q.correctOption)).toBe(true)
      }
    })

    it('draws distractors from other cards in the deck, not from the same card', () => {
      const cards = makeCards(4)
      const questions = generateTest(cards).filter(
        (q): q is Extract<TestQuestion, { format: 'multiple-choice' }> => q.format === 'multiple-choice',
      )
      for (const q of questions) {
        const otherAnswers = cards.filter((c) => c.id !== q.cardId).map((c) => (c.content as ShortAnswerContent).answer)
        for (const option of q.options) {
          if (option !== q.correctOption) expect(otherAnswers).toContain(option)
        }
      }
    })
  })

  it('written questions carry the front/back pair straight through', () => {
    const cards = makeCards(1)
    const [question] = generateTest(cards)
    expect(question).toMatchObject({
      format: 'written',
      front: 'Term 0',
      correctAnswer: 'Definition 0',
    })
  })
})
