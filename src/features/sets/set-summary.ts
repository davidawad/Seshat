import { isDue } from '../../lib/fsrs'
import type { StudyCard } from '../../types'

/**
 * A read-only rollup of a set's current study state, for display on the set
 * landing page (SetDetail). Pure query over each card's existing
 * `scheduling` — deliberately doesn't touch FSRS itself, just reads what's
 * already there.
 */
export interface SetMastery {
  readonly total: number
  /** Due for review — previously studied at least once, and due again. Excludes never-studied cards (see `newCount`); a never-studied card is due by construction (`createInitialScheduling` seeds `due` at creation time), so counting it under both would double-count the same cards under two labels. */
  readonly due: number
  /** Never studied yet (`scheduling.state === 'New'`), regardless of its (always-due) `due` date. */
  readonly newCount: number
  readonly lastStudied: Date | null
}

export const summarizeMastery = (cards: readonly StudyCard[], now: Date): SetMastery => {
  let due = 0
  let newCount = 0
  let lastStudied: Date | null = null

  for (const card of cards) {
    const isNew = card.scheduling.state === 'New'
    if (isNew) newCount += 1
    else if (isDue(card.scheduling, now)) due += 1
    if (card.scheduling.lastReview !== null) {
      const reviewedAt = new Date(card.scheduling.lastReview)
      if (lastStudied === null || reviewedAt > lastStudied) lastStudied = reviewedAt
    }
  }

  return { total: cards.length, due, newCount, lastStudied }
}
