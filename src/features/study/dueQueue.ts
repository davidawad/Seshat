import { isDue } from '../../lib/fsrs'
import type { CardId, DeckId, StudyCard } from '../../types'

/**
 * The default study queue: every due card across all decks (or a single
 * deck, when `deckId` is given), oldest-due-first. Pure and React-free so it
 * can be snapshotted once per study session — see `ReviewSession`'s caller
 * for why the queue is deliberately not recomputed on every card update.
 */
export const selectDueQueue = (cards: readonly StudyCard[], deckId: DeckId | null, now: Date): CardId[] =>
  cards
    .filter((card) => (deckId === null || card.deckId === deckId) && isDue(card.scheduling, now))
    .toSorted((a, b) => new Date(a.scheduling.due).getTime() - new Date(b.scheduling.due).getTime())
    .map((card) => card.id)
