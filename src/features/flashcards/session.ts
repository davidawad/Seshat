import type { CardId } from '../../types'
import { shuffle } from './shuffle'

/**
 * Pure session state for the Flashcards mode: an order over a set's cards
 * plus a cursor and the ids sorted into known/unknown as the learner grades
 * each one. Kept as a plain value + pure transitions (rather than folded
 * into component state) so the advance/completion logic is unit-testable
 * without React. `knownIds`/`unknownIds` (not just counts) are what let the
 * end-of-session screen offer "restudy just the unknown ones."
 */
export interface FlashcardSessionState {
  readonly order: readonly CardId[]
  readonly position: number
  readonly knownIds: readonly CardId[]
  readonly unknownIds: readonly CardId[]
}

export type FlashcardOrder = 'shuffled' | 'original'

/** Starts a new session over `cardIds`, either Fisher-Yates shuffled or in the given order. */
export const createFlashcardSession = (
  cardIds: readonly CardId[],
  order: FlashcardOrder = 'shuffled',
  random: () => number = Math.random,
): FlashcardSessionState => ({
  order: order === 'shuffled' ? shuffle(cardIds, random) : cardIds,
  position: 0,
  knownIds: [],
  unknownIds: [],
})

export const isSessionComplete = (session: FlashcardSessionState): boolean => session.position >= session.order.length

/** The card id currently on screen, or `null` once the session is complete. */
export const currentCardId = (session: FlashcardSessionState): CardId | null => {
  const id = session.order[session.position]
  return id ?? null
}

/** Records a Know/Don't-know outcome for the current card and moves the cursor forward. */
export const advanceSession = (session: FlashcardSessionState, known: boolean): FlashcardSessionState => {
  const cardId = currentCardId(session)
  return {
    ...session,
    position: session.position + 1,
    knownIds: known && cardId !== null ? [...session.knownIds, cardId] : session.knownIds,
    unknownIds: !known && cardId !== null ? [...session.unknownIds, cardId] : session.unknownIds,
  }
}
