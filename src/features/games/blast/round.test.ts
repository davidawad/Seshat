import { describe, expect, it } from 'vitest'
import type { CardId } from '../../../types'
import { type BlastPair, MAX_OPTIONS, buildPromptOrder, buildQuestion, buildRound } from './round'

const makePairs = (count: number): BlastPair[] =>
  Array.from({ length: count }, (_, i) => ({
    cardId: `card-${i}` as CardId,
    front: `front-${i}`,
    back: `back-${i}`,
  }))

/** A fixed, non-random sequence so shuffling/side-picking is deterministic in tests. */
const fakeRandomSequence = (values: readonly number[]): (() => number) => {
  let i = 0
  return () => {
    const value = values[i % values.length] as number
    i += 1
    return value
  }
}

describe('buildPromptOrder', () => {
  it('includes every pair exactly once', () => {
    const pairs = makePairs(6)
    const order = buildPromptOrder(pairs, Math.random)
    expect(order).toHaveLength(6)
    expect(new Set(order.map((p) => p.cardId))).toEqual(new Set(pairs.map((p) => p.cardId)))
  })

  it('is deterministic for a fixed random source', () => {
    const pairs = makePairs(5)
    const a = buildPromptOrder(pairs, fakeRandomSequence([0.1, 0.2, 0.3, 0.9, 0.5]))
    const b = buildPromptOrder(pairs, fakeRandomSequence([0.1, 0.2, 0.3, 0.9, 0.5]))
    expect(a).toEqual(b)
  })

  it('does not mutate its input', () => {
    const pairs = makePairs(4)
    const snapshot = [...pairs]
    buildPromptOrder(pairs, Math.random)
    expect(pairs).toEqual(snapshot)
  })
})

describe('buildQuestion', () => {
  it('picks the prompt side and its opposite as the correct option', () => {
    const pairs = makePairs(6)
    const target = pairs[0] as BlastPair

    // random() < 0.5 -> 'front' prompt, so correct option is the back.
    const front = buildQuestion(target, pairs, fakeRandomSequence([0.1, 0.5, 0.5, 0.5, 0.5]))
    expect(front.promptSide).toBe('front')
    expect(front.prompt).toBe(target.front)
    expect(front.correctOption).toBe(target.back)
    expect(front.options).toContain(target.back)

    // random() >= 0.5 -> 'back' prompt, so correct option is the front.
    const back = buildQuestion(target, pairs, fakeRandomSequence([0.9, 0.5, 0.5, 0.5, 0.5]))
    expect(back.promptSide).toBe('back')
    expect(back.prompt).toBe(target.back)
    expect(back.correctOption).toBe(target.front)
    expect(back.options).toContain(target.front)
  })

  it('includes up to MAX_OPTIONS - 1 decoys drawn only from other cards', () => {
    const pairs = makePairs(10)
    const target = pairs[0] as BlastPair
    const question = buildQuestion(target, pairs, Math.random)

    expect(question.options.length).toBeLessThanOrEqual(MAX_OPTIONS)
    expect(question.options).toContain(question.correctOption)
    expect(new Set(question.options).size).toBe(question.options.length) // no duplicate options

    const decoys = question.options.filter((option) => option !== question.correctOption)
    const otherSideTexts =
      question.promptSide === 'front' ? pairs.slice(1).map((p) => p.back) : pairs.slice(1).map((p) => p.front)
    for (const decoy of decoys) {
      expect(otherSideTexts).toContain(decoy)
    }
  })

  it('yields fewer than MAX_OPTIONS - 1 decoys when the set cannot supply enough distinct answers', () => {
    // Only one other pair exists, so at most 1 decoy is available regardless of MAX_OPTIONS.
    const pairs = makePairs(2)
    const target = pairs[0] as BlastPair
    const question = buildQuestion(target, pairs, Math.random)
    expect(question.options.length).toBeLessThanOrEqual(2)
    expect(question.options).toContain(question.correctOption)
  })

  it('excludes decoys equal to the correct answer text', () => {
    const pairs: BlastPair[] = [
      { cardId: 'card-0' as CardId, front: 'term-0', back: 'shared-answer' },
      { cardId: 'card-1' as CardId, front: 'term-1', back: 'shared-answer' },
      { cardId: 'card-2' as CardId, front: 'term-2', back: 'unique-answer' },
      { cardId: 'card-3' as CardId, front: 'term-3', back: 'another-answer' },
    ]
    const target = pairs[0] as BlastPair
    // Force a 'front' prompt so the correct/decoy pool is the `back` fields.
    const question = buildQuestion(target, pairs, fakeRandomSequence([0.1, 0.5, 0.5, 0.5]))
    expect(question.correctOption).toBe('shared-answer')
    const decoys = question.options.filter((option) => option !== question.correctOption)
    expect(decoys).not.toContain('shared-answer')
  })
})

describe('buildRound', () => {
  it('produces one question per pair', () => {
    const pairs = makePairs(7)
    const round = buildRound(pairs, Math.random)
    expect(round).toHaveLength(7)
    expect(new Set(round.map((q) => q.cardId))).toEqual(new Set(pairs.map((p) => p.cardId)))
  })

  it('every question has a correct option present among its options', () => {
    const pairs = makePairs(9)
    const round = buildRound(pairs, Math.random)
    for (const question of round) {
      expect(question.options).toContain(question.correctOption)
    }
  })

  it('is deterministic for a fixed random source', () => {
    const pairs = makePairs(5)
    const values = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95, 0.11, 0.22, 0.33, 0.44, 0.66]
    const a = buildRound(pairs, fakeRandomSequence(values))
    const b = buildRound(pairs, fakeRandomSequence(values))
    expect(a).toEqual(b)
  })

  it('returns an empty round for zero pairs', () => {
    expect(buildRound([], Math.random)).toEqual([])
  })
})
