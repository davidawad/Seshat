import type { CardId } from '../../../types'

/**
 * Pure round setup for Blast: for each card in turn (prompt order shuffled),
 * build a multiple-choice "which rock is the right one" question — a prompt
 * (a card's term or definition, picked at random) plus a handful of
 * "asteroid" answer options, one correct and the rest decoys drawn from
 * other cards in the set. Kept free of React/DOM so it's fully unit-
 * testable — see round.test.ts. Deliberately not shared with
 * test-mode/generate-test.ts's own `shuffle`/`pickDistinct` — this
 * codebase's convention is small per-feature duplicated pure helpers (see
 * match/round.ts, flashcards/shuffle.ts) rather than one shared utility.
 */

/**
 * Blast needs enough cards to fill an asteroid field with decoys that are
 * actually distinguishable from the correct answer — the same floor
 * test-mode/generate-test.ts uses for its own multiple-choice format
 * (>=4 cards: 1 correct answer + up to 3 decoys pulled from the rest of the
 * set). Below that, "blast the right rock" degenerates to a single obvious
 * asteroid, so the game simply isn't offered on smaller sets.
 */
export const MIN_CARDS = 4

/** Asteroids on screen per question, correct answer included. */
export const MAX_OPTIONS = 4

/** Lives a run starts with; the game ends at 0. */
export const START_LIVES = 3

export interface BlastPair {
  readonly cardId: CardId
  readonly front: string
  readonly back: string
}

export type PromptSide = 'front' | 'back'

export interface BlastQuestion {
  readonly cardId: CardId
  readonly prompt: string
  readonly promptSide: PromptSide
  /** Shuffled; includes the correct answer plus up to `MAX_OPTIONS - 1` decoys. */
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
 * `count` decoys — callers render whatever comes back rather than assuming a
 * fixed option count.
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

/** Shuffles the order in which each pair gets a turn as the prompt this round. */
export const buildPromptOrder = (pairs: readonly BlastPair[], random: () => number = Math.random): BlastPair[] =>
  shuffle(pairs, random)

/**
 * Builds one question for `pair`: a random side (term or definition) as the
 * prompt, the opposite side as the correct answer, and up to
 * `MAX_OPTIONS - 1` decoys of the same side drawn from the rest of `pairs`.
 */
export const buildQuestion = (
  pair: BlastPair,
  pairs: readonly BlastPair[],
  random: () => number = Math.random,
): BlastQuestion => {
  const promptSide: PromptSide = random() < 0.5 ? 'front' : 'back'
  const prompt = promptSide === 'front' ? pair.front : pair.back
  const correctOption = promptSide === 'front' ? pair.back : pair.front

  const decoyPool = pairs
    .filter((other) => other.cardId !== pair.cardId)
    .map((other) => (promptSide === 'front' ? other.back : other.front))
  const decoys = pickDistinct(decoyPool, correctOption, MAX_OPTIONS - 1, random)

  return {
    cardId: pair.cardId,
    prompt,
    promptSide,
    options: shuffle([correctOption, ...decoys], random),
    correctOption,
  }
}

/**
 * Builds a full round: every pair gets exactly one turn as the prompt, in a
 * shuffled order, each with its own freshly-built question (own random
 * prompt side and decoys).
 */
export const buildRound = (pairs: readonly BlastPair[], random: () => number = Math.random): BlastQuestion[] =>
  buildPromptOrder(pairs, random).map((pair) => buildQuestion(pair, pairs, random))
