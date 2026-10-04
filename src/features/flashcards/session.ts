import type { CardId, StudyCard } from '../../types'
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

/**
 * One graded card, kept just long enough to be undone. `previousScheduling`
 * and `reviewedAt` are null when progress tracking was off for that grade
 * (nothing was written to the store, so there is nothing to roll back there).
 */
export interface GradeRecord {
  readonly cardId: CardId
  readonly known: boolean
  readonly previousScheduling: StudyCard['scheduling'] | null
  readonly reviewedAt: string | null
}

/** A session plus the stack of grades that can still be undone, newest last. */
export interface FlashcardRun {
  readonly session: FlashcardSessionState
  readonly history: readonly GradeRecord[]
}

export const createFlashcardRun = (session: FlashcardSessionState): FlashcardRun => ({ session, history: [] })

export const canUndo = (run: FlashcardRun): boolean => run.history.length > 0

/** Advances the session for `record`'s outcome and remembers it on the undo stack. */
export const gradeRun = (run: FlashcardRun, record: GradeRecord): FlashcardRun => ({
  session: advanceSession(run.session, record.known),
  history: [...run.history, record],
})

const withoutLast = <T>(items: readonly T[]): readonly T[] => items.slice(0, -1)

/**
 * Steps back one card: moves the cursor back and takes the card out of the
 * known/unknown bucket it was sorted into. Returns the popped record too so
 * the caller can roll the store back; `undone` is null when there is nothing
 * to undo (the run comes back unchanged).
 */
export const undoRun = (run: FlashcardRun): { readonly run: FlashcardRun; readonly undone: GradeRecord | null } => {
  const undone = run.history[run.history.length - 1]
  if (undone === undefined) return { run, undone: null }
  const { session } = run
  return {
    run: {
      session: {
        ...session,
        position: Math.max(0, session.position - 1),
        knownIds: undone.known ? withoutLast(session.knownIds) : session.knownIds,
        unknownIds: undone.known ? session.unknownIds : withoutLast(session.unknownIds),
      },
      history: withoutLast(run.history),
    },
    undone,
  }
}
