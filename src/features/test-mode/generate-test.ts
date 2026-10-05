import type { MediaRef } from '../../lib/media/types'
import type { CardId, StudyCard } from '../../types'
import { cardFrontBack } from '../study/card-summary'
import { textCards } from '../study/text-cards'

/**
 * A set larger than this only contributes a random subset to any one test —
 * keeps a single-page "take it all in one sitting" test from becoming
 * unwieldy on a 200-card set, while still exercising a representative
 * sample (one question per card, up to the cap).
 */
export const MAX_TEST_QUESTIONS = 20

export type QuestionFormat = 'written' | 'true-false' | 'multiple-choice'

interface BaseQuestion {
  readonly cardId: CardId
  readonly front: string
  /** The card's prompt image (MediaRef), when it has one. */
  readonly image?: MediaRef
}

export interface WrittenQuestion extends BaseQuestion {
  readonly format: 'written'
  readonly correctAnswer: string
}

export interface TrueFalseQuestion extends BaseQuestion {
  readonly format: 'true-false'
  /** The `back` shown to the learner alongside `front` — real or borrowed. */
  readonly claimedAnswer: string
  /** Whether `claimedAnswer` is actually this card's own answer. */
  readonly claimIsTrue: boolean
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  readonly format: 'multiple-choice'
  /** Shuffled; includes the real answer plus up to 3 distractors. */
  readonly options: readonly string[]
  readonly correctOption: string
}

export type TestQuestion = WrittenQuestion | TrueFalseQuestion | MultipleChoiceQuestion

/**
 * Fisher-Yates shuffle with an injectable random source (defaults to
 * `Math.random`) so callers — notably tests — can pass a fixed sequence and
 * get a deterministic, verifiable permutation instead of asserting against
 * true randomness.
 */
export const shuffle = <T>(items: readonly T[], random: () => number = Math.random): T[] => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const a = result[i]!
    const b = result[j]!
    result[i] = b
    result[j] = a
  }
  return result
}

interface FrontBackPair {
  readonly card: StudyCard
  readonly front: string
  readonly back: string
  readonly image?: MediaRef
}

const imageOf = (pair: FrontBackPair): { readonly image?: MediaRef } =>
  pair.image === undefined ? {} : { image: pair.image }

/**
 * Picks up to `count` distractor answers from `pool`, excluding anything
 * equal to `exclude` (by normalized-ish plain string equality — good enough
 * here since these are display strings, not graded input) and de-duplicated
 * against each other. A set with lots of duplicate/near-duplicate answers
 * can legitimately yield fewer than `count` distractors; callers render
 * whatever comes back rather than assuming a fixed length.
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
 * One multiple-choice question for `pair`: its real answer plus up to 3
 * distractors drawn from the other cards' answers, shuffled. Shared with
 * Learn mode's recognition stage. Fewer than 3 distractors is legitimate
 * for a small or repetitive set; callers decide whether that is enough.
 */
const multipleChoiceFor = (
  pair: FrontBackPair,
  otherPairs: readonly FrontBackPair[],
  random: () => number,
): MultipleChoiceQuestion => {
  const distractors = pickDistinct(
    otherPairs.map((other) => other.back),
    pair.back,
    3,
    random,
  )
  return {
    format: 'multiple-choice',
    cardId: pair.card.id,
    front: pair.front,
    ...imageOf(pair),
    options: shuffle([pair.back, ...distractors], random),
    correctOption: pair.back,
  }
}

/**
 * The multiple-choice question for one `card`, with distractors from the other
 * text cards in `cards` (the same set). Used by Learn mode's recognition stage.
 */
export const buildMultipleChoice = (
  card: StudyCard,
  cards: readonly StudyCard[],
  random: () => number = Math.random,
): MultipleChoiceQuestion => {
  const pairs: FrontBackPair[] = textCards(cards).map((other) => ({ card: other, ...cardFrontBack(other) }))
  const pair: FrontBackPair = { card, ...cardFrontBack(card) }
  return multipleChoiceFor(
    pair,
    pairs.filter((other) => other.card.id !== card.id),
    random,
  )
}

/**
 * Generates a multi-format practice test covering (up to `MAX_TEST_QUESTIONS`
 * of) a set's cards. Each card becomes one question in one of three formats
 * — written recall, true/false, or multiple-choice — distributed round-robin
 * over the (already-shuffled) question order so formats spread roughly
 * evenly rather than clustering.
 *
 * True/false and multiple-choice need other cards in the set to source
 * fair, non-repeating decoys, so they're only offered when the set is large
 * enough to supply them (>=2 total cards for true/false, >=4 for
 * multiple-choice); smaller sets fall back to written-only questions for
 * every card.
 */
export const generateTest = (allCards: readonly StudyCard[], random: () => number = Math.random): TestQuestion[] => {
  // Image-occlusion cards would become unanswerable text questions (the
  // image is dropped by `cardFrontBack`), so they never enter a test.
  const cards = textCards(allCards)
  if (cards.length === 0) return []

  const allPairs: FrontBackPair[] = cards.map((card) => ({ card, ...cardFrontBack(card) }))
  const selected = shuffle(allPairs, random).slice(0, MAX_TEST_QUESTIONS)

  const canTrueFalse = cards.length >= 2
  const canMultipleChoice = cards.length >= 4

  const formatCycle: QuestionFormat[] = [
    'written',
    ...(canTrueFalse ? (['true-false'] as const) : []),
    ...(canMultipleChoice ? (['multiple-choice'] as const) : []),
  ]

  return selected.map((pair, index): TestQuestion => {
    // `formatCycle` is never empty ('written' always included) and `index`
    // is always non-negative, so this modulo indexed access always resolves.
    const format = formatCycle[index % formatCycle.length]!
    const otherPairs = allPairs.filter((other) => other.card.id !== pair.card.id)

    switch (format) {
      case 'written':
        return {
          format: 'written',
          cardId: pair.card.id,
          front: pair.front,
          ...imageOf(pair),
          correctAnswer: pair.back,
        }

      case 'true-false': {
        const decoyCandidates = pickDistinct(
          otherPairs.map((other) => other.back),
          pair.back,
          1,
          random,
        )
        const decoy = decoyCandidates[0]
        // No usable decoy (e.g. every other card shares this card's answer
        // text) falls back to a true claim rather than presenting an
        // unanswerable "false" question.
        const claimIsTrue = decoy === undefined || random() < 0.5
        return {
          format: 'true-false',
          cardId: pair.card.id,
          front: pair.front,
          ...imageOf(pair),
          claimedAnswer: claimIsTrue ? pair.back : decoy!,
          claimIsTrue,
        }
      }

      case 'multiple-choice':
        return multipleChoiceFor(pair, otherPairs, random)
    }
  })
}
