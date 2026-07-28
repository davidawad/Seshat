import type { CardId } from '../../types'
import { shuffle } from './shuffle'

/**
 * Pure session state for the Flashcards mode: a shuffled order over a
 * deck's cards plus a cursor and a running "known" tally. Kept as a plain
 * value + pure transitions (rather than folded into component state) so
 * the advance/completion logic is unit-testable without React.
 */
export interface FlashcardSessionState {
  readonly order: readonly CardId[]
  readonly position: number
  readonly knownCount: number
}

/** Starts a new session over `cardIds`, shuffled via Fisher-Yates. */
export const createFlashcardSession = (
  cardIds: readonly CardId[],
  random: () => number = Math.random,
): FlashcardSessionState => ({
  order: shuffle(cardIds, random),
  position: 0,
  knownCount: 0,
})

export const isSessionComplete = (session: FlashcardSessionState): boolean => session.position >= session.order.length

/** The card id currently on screen, or `null` once the session is complete. */
export const currentCardId = (session: FlashcardSessionState): CardId | null => {
  const id = session.order[session.position]
  return id ?? null
}

/** Records a Know/Don't-know outcome for the current card and moves the cursor forward. */
export const advanceSession = (session: FlashcardSessionState, known: boolean): FlashcardSessionState => ({
  ...session,
  position: session.position + 1,
  knownCount: session.knownCount + (known ? 1 : 0),
})
