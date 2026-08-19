import type { CardId, StudyCard } from '../../../types'
import { cardFrontBack } from '../../study/card-summary'

/**
 * Pure question setup for Blocks: turns a set's cards into a shuffled queue
 * of multiple-choice questions, one per card, each showing either the term
 * or the definition as the prompt with the other side as the correct
 * option. Kept free of React/DOM so it's fully unit-testable — see
 * round.test.ts. Deliberately does not import `pickDistinct`/`shuffle` from
 * `generate-test.ts` — this codebase keeps small pure helpers like these
 * duplicated per-feature (see round.ts, generate-test.ts, and
 * flashcards/shuffle.ts each having their own local `shuffle`).
 */

/** 1 correct option + 3 decoys, matching test-mode's multiple-choice question shape. */
export const OPTION_COUNT = 4

/** Needs at least 3 *other* cards to supply distinct decoys for every question, so >=4 total. */
export const MIN_CARDS = 4

export type PromptSide = 'front' | 'back'

export interface BlocksQuestion {
  readonly cardId: CardId
  readonly prompt: string
  /** Shuffled; includes the correct option plus up to `OPTION_COUNT - 1` decoys. */
  readonly options: readonly string[]
  readonly correctOption: string
}

/** Fisher-Yates shuffle. Pure and injectable-random for deterministic tests. */
const shuffle = <T>(items: readonly T[], random: () => number): T[] => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const swap = result[i] as T
    result[i] = result[j] as T
    result[j] = swap
  }
  return result
}

/**
 * Picks up to `count` decoy answers from `pool`, excluding anything equal to
 * `exclude` and de-duplicated against each other. A set with lots of
 * duplicate/near-duplicate answer text can legitimately yield fewer than
 * `count` decoys — callers render whatever comes back rather than assuming
 * a fixed option count.
 */
const pickDistinct = (pool: readonly string[], exclude: string, count: number, random: () => number): string[] => {
  const seen = new Set<string>([exclude])
  const picked: string[] = []
  for (const candidate of shuffle(pool, random)) {
    if (picked.length >= count) break
    if (seen.has(candidate)) continue
    seen.add(candidate)
    picked.push(candidate)
  }
  return picked
}

/**
 * Builds the full question queue for one game: every card becomes exactly
 * one question, in a shuffled order, with a randomly-chosen prompt side
 * (term or definition) per card. Decoys are drawn from the *other* cards'
 * text on the matching side (e.g. if the prompt is a term, decoys are other
 * cards' definitions), so every option in a question reads as the same kind
 * of text.
 */
export const buildQuestions = (cards: readonly StudyCard[], random: () => number = Math.random): BlocksQuestion[] => {
  const pairs = cards.map((card) => ({ card, ...cardFrontBack(card) }))

  return shuffle(pairs, random).map((pair): BlocksQuestion => {
    const side: PromptSide = random() < 0.5 ? 'front' : 'back'
    const prompt = side === 'front' ? pair.front : pair.back
    const correctOption = side === 'front' ? pair.back : pair.front

    const decoyPool = pairs
      .filter((other) => other.card.id !== pair.card.id)
      .map((other) => (side === 'front' ? other.back : other.front))
    const decoys = pickDistinct(decoyPool, correctOption, OPTION_COUNT - 1, random)

    return {
      cardId: pair.card.id,
      prompt,
      options: shuffle([correctOption, ...decoys], random),
      correctOption,
    }
  })
}
