import type { AppState, Folder, ReviewLogEntry, StudyCard } from '../../types'
import { dueBacklogCount, newCardCount, retentionEstimate, reviewedTodayCount } from './calibration'

/** Stats over a slice of the app: every set, one set, or the sets in a folder. */
export interface StatsScope {
  readonly cards: readonly StudyCard[]
  readonly reviewLog: readonly ReviewLogEntry[]
}

export interface ScopeSummary {
  readonly cardCount: number
  readonly due: number
  readonly newCount: number
  readonly reviewedToday: number
  readonly reviewsTotal: number
  /** Fraction of all logged reviews answered correctly, or `null` before any review. */
  readonly correctRate: number | null
  readonly retention: number | null
}

/** Cards and review history restricted to `setIds`. */
export const scopeToSets = (state: Pick<AppState, 'cards' | 'reviewLog'>, setIds: ReadonlySet<string>): StatsScope => ({
  cards: state.cards.filter((card) => setIds.has(card.setId)),
  reviewLog: state.reviewLog.filter((entry) => setIds.has(entry.setId)),
})

/** The sets a folder holds, as a lookup set. */
export const folderSetIds = (folder: Pick<Folder, 'setIds'>): ReadonlySet<string> => new Set<string>(folder.setIds)

export const summarizeScope = ({ cards, reviewLog }: StatsScope, now: Date): ScopeSummary => ({
  cardCount: cards.length,
  due: dueBacklogCount(cards, now),
  newCount: newCardCount(cards),
  reviewedToday: reviewedTodayCount(reviewLog, now),
  reviewsTotal: reviewLog.length,
  correctRate: reviewLog.length === 0 ? null : reviewLog.filter((entry) => entry.correct).length / reviewLog.length,
  retention: retentionEstimate(reviewLog),
})

export const formatPercent = (value: number): string => `${Math.round(value * 100)}%`
