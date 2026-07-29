import { isDue } from '../../lib/fsrs'
import type { CardId, SetId, StudyCard } from '../../types'

/**
 * A card's interleaving category: its first tag (the finer-grained "concept"
 * label) if it has any, otherwise its set (the coarse fallback grouping).
 * See research/learning-science/brunmair-richter-2019.md — deliberate
 * mixing of confusable/related categories aids discrimination and transfer;
 * this is what makes a category grouping meaningful rather than arbitrary.
 */
const categoryOf = (card: StudyCard): string => card.tags[0] ?? card.setId

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
 * How many other cards a lapsed card is pushed past before it reappears in
 * the same session — not immediately (that would be massed restudy), but
 * before the session ends. See research/learning-science/latimier-2021.md:
 * spaced retrieval beats massed retrieval even at this short a timescale.
 */
const RELEARN_GAP = 5

/**
 * Schedules a second, future appearance of a just-failed card ("again")
 * `RELEARN_GAP` cards later in an in-progress session queue, instead of
 * leaving its next appearance to whatever FSRS's next `due` date turns out
 * to be (which could be days away — no good for a card the learner clearly
 * hasn't learned yet).
 *
 * Pure and index-based: `position` is the index the card was just shown at.
 * That slot is left alone — the session's position pointer has already
 * moved past it, so it's never re-displayed — and a second occurrence of
 * `cardId` is spliced in `RELEARN_GAP` cards further along, clamped to
 * whatever remains so a lapse near the end of a session doesn't get lost
 * past the array's end.
 */
export const reinsertForRelearning = (
  queue: readonly CardId[],
  position: number,
  cardId: CardId,
): readonly CardId[] => {
  const remaining = queue.length - position - 1
  if (remaining <= 0) return [...queue, cardId]

  const gap = Math.min(RELEARN_GAP, remaining)
  const insertAt = position + 1 + gap
  const next = [...queue]
  next.splice(insertAt, 0, cardId)
  return next
}

/**
 * The default study queue: every due card across all sets (or a single
 * set, when `setId` is given), oldest-due-first and then interleaved by
 * category so related-but-distinct material is mixed rather than blocked
 * (see `interleaveByCategory`). Pure and React-free so it can be
 * snapshotted once per study session — see `ReviewSession`'s caller for why
 * the queue is deliberately not recomputed on every card update.
 */
export const selectDueQueue = (cards: readonly StudyCard[], setId: SetId | null, now: Date): CardId[] => {
  const due = cards
    .filter((card) => (setId === null || card.setId === setId) && isDue(card.scheduling, now))
    .toSorted((a, b) => new Date(a.scheduling.due).getTime() - new Date(b.scheduling.due).getTime())
    .map((card) => card.id)

  return [...interleaveByCategory(cards, due)]
}
