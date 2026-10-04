import { describe, expect, it } from 'vitest'
import type { CardContent, CardId, SetId, StudyCard } from '../../types'
import { buildQuestions } from '../games/blocks/round'
import { generateTest } from '../test-mode/generate-test'
import { imageCardCount, imageCardsNote, isImageCard, textCards } from './text-cards'

let counter = 0
const makeCardOf = (prompt: string, content: CardContent): StudyCard => {
  counter += 1
  return {
    id: `card-${counter}` as CardId,
    setId: 'set-fixture' as SetId,
    prompt,
    promptImage: null,
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

const text = (term: string) =>
  makeCardOf(term, { kind: 'short-answer', answer: `${term}-def`, acceptableAnswers: [], answerImage: null })
const image = (prompt: string) =>
  makeCardOf(prompt, {
    kind: 'image-occlusion',
    image: null,
    imageDataUrl: 'data:image/jpeg;base64,AAAA',
    occlusions: [{ id: 'r1', xPct: 0, yPct: 0, widthPct: 50, heightPct: 50, label: 'Heart' }],
  })

describe('text-cards helpers', () => {
  const cards = [text('a'), image('x'), text('b'), image('y'), image('z')]

  it('separates image cards from text cards', () => {
    expect(isImageCard(cards[1]!)).toBe(true)
    expect(textCards(cards).map((c) => c.prompt)).toEqual(['a', 'b'])
    expect(imageCardCount(cards)).toBe(3)
  })

  it('words the note, and is null when there are no image cards', () => {
    expect(imageCardsNote(0)).toBeNull()
    expect(imageCardsNote(1)).toBe('1 image card is only available in Study and Flashcards.')
    expect(imageCardsNote(3)).toBe('3 image cards are only available in Study and Flashcards.')
  })
})

describe('image cards are excluded from text-only modes', () => {
  const cards = [text('a'), text('b'), text('c'), text('d'), image('x'), image('y')]

  it('generateTest asks no questions about image cards', () => {
    const imageIds = new Set(cards.filter(isImageCard).map((c) => c.id))
    const questions = generateTest(cards)
    expect(questions).toHaveLength(4)
    expect(questions.some((q) => imageIds.has(q.cardId))).toBe(false)
  })

  it('generateTest on an all-image set yields no questions instead of crashing', () => {
    expect(generateTest([image('x'), image('y')])).toEqual([])
  })

  it('Blocks never builds a question from an image card, nor offers its label as a decoy', () => {
    const questions = buildQuestions(cards)
    expect(questions).toHaveLength(4)
    for (const question of questions) {
      expect(question.options).not.toContain('Heart')
      expect(question.prompt).not.toBe('x')
    }
    expect(buildQuestions([image('x')])).toEqual([])
  })
})
