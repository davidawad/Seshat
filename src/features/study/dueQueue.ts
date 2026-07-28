import { isDue } from '../../lib/fsrs'
import type { CardId, DeckId, StudyCard } from '../../types'

/**
 * A card's interleaving category: its first tag (the finer-grained "concept"
 * label) if it has any, otherwise its deck (the coarse fallback grouping).
 * See research/learning-science/brunmair-richter-2019.md — deliberate
 * mixing of confusable/related categories aids discrimination and transfer;
 * this is what makes a category grouping meaningful rather than arbitrary.
 */
const categoryOf = (card: StudyCard): string => card.tags[0] ?? card.deckId

/**
 * Number of distinct interleaving categories represented in `cardIds`. Used
 * by the study page to decide whether an "interleaved across topics" note
 * is relevant — a single category has nothing to interleave against.
 */
export const countDueCategories = (cards: readonly StudyCard[], cardIds: readonly CardId[]): number => {
  const cardById = new Map(cards.map((card) => [card.id, card] as const))
  const categories = new Set<string>()
  for (const id of cardIds) {
    const card = cardById.get(id)
    categories.add(card === undefined ? id : categoryOf(card))
  }
  return categories.size
}

/**
 * Re-orders an already-selected set of due cards so consecutive cards
 * alternate between categories (deal-from-multiple-piles round-robin)
 * instead of being blocked (all of category A, then all of category B).
 *
 * Deterministic and pure: no randomness, no shuffling. Category order is
 * first-appearance order within `dueIds` (so with the default oldest-due-
 * first input, the "oldest" category still leads); within a category,
 * relative order from `dueIds` is preserved. A single-category input (or an
 * empty one) is returned unchanged since there's nothing to interleave.
 */
export const interleaveByCategory = (cards: readonly StudyCard[], dueIds: readonly CardId[]): readonly CardId[] => {
  if (dueIds.length === 0) return dueIds

  const cardById = new Map(cards.map((card) => [card.id, card] as const))
  const idCategory = (id: CardId): string => {
    const card = cardById.get(id)
    // Defensive fallback for an id with no matching card — treat it as its
    // own singleton category rather than crashing or mis-grouping it.
    return card === undefined ? id : categoryOf(card)
  }

  const categoryOrder: string[] = []
  const groups = new Map<string, CardId[]>()
  for (const id of dueIds) {
    const category = idCategory(id)
    const group = groups.get(category)
    if (group === undefined) {
      categoryOrder.push(category)
      groups.set(category, [id])
    } else {
      group.push(id)
    }
  }

  if (categoryOrder.length <= 1) return dueIds

  const result: CardId[] = []
  const nextIndex = new Map<string, number>(categoryOrder.map((category) => [category, 0]))
  let remaining = dueIds.length
  let cursor = 0
  while (remaining > 0) {
    const category = categoryOrder[cursor % categoryOrder.length]!
    cursor += 1
    const index = nextIndex.get(category)!
    const group = groups.get(category)!
    if (index >= group.length) continue
    result.push(group[index]!)
    nextIndex.set(category, index + 1)
    remaining -= 1
  }

  return result
}

/**
 * The default study queue: every due card across all decks (or a single
 * deck, when `deckId` is given), oldest-due-first and then interleaved by
 * category so related-but-distinct material is mixed rather than blocked
 * (see `interleaveByCategory`). Pure and React-free so it can be
 * snapshotted once per study session — see `ReviewSession`'s caller for why
 * the queue is deliberately not recomputed on every card update.
 */
export const selectDueQueue = (cards: readonly StudyCard[], deckId: DeckId | null, now: Date): CardId[] => {
  const due = cards
    .filter((card) => (deckId === null || card.deckId === deckId) && isDue(card.scheduling, now))
    .toSorted((a, b) => new Date(a.scheduling.due).getTime() - new Date(b.scheduling.due).getTime())
    .map((card) => card.id)

  return [...interleaveByCategory(cards, due)]
}
