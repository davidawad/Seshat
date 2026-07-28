import { isDue } from '../../lib/fsrs'
import type { ConfidenceRating, ReviewLogEntry, StudyCard } from '../../types'

/**
 * Pure, React-free stats math for the "honest progress" dashboard. Deliberately
 * has no streak/exposure-count metrics — the point of this page is to surface
 * the gap between how confident learners feel and how often they're actually
 * right (the fluency illusion), not to gamify session counts.
 */

const CONFIDENCE_ORDER: readonly ConfidenceRating[] = ['guessed', 'unsure', 'sure']

export interface CalibrationBucket {
  readonly confidence: ConfidenceRating
  readonly total: number
  readonly correct: number
  /** Fraction of reviews in this bucket that were correct, or `null` with no data yet. */
  readonly correctRate: number | null
}

/** Observed correct-rate per confidence bucket — the calibration table's raw material. */
export const calibrationBuckets = (reviewLog: readonly ReviewLogEntry[]): CalibrationBucket[] =>
  CONFIDENCE_ORDER.map((confidence) => {
    const entries = reviewLog.filter((entry) => entry.confidence === confidence)
    const correct = entries.filter((entry) => entry.correct).length
    return {
      confidence,
      total: entries.length,
      correct,
      correctRate: entries.length === 0 ? null : correct / entries.length,
    }
  })

/** How many cards are due right now, across the given scope. */
export const dueBacklogCount = (cards: readonly StudyCard[], now: Date): number =>
  cards.filter((card) => isDue(card.scheduling, now)).length

/** How many reviews were logged since local midnight. */
export const reviewedTodayCount = (reviewLog: readonly ReviewLogEntry[], now: Date): number => {
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  return reviewLog.filter((entry) => new Date(entry.reviewedAt).getTime() >= startOfDay.getTime()).length
}

/**
 * A rolling retention estimate over the most recent reviews. Prefers the
 * average FSRS `retrievabilityAtReview` (the model's own prediction of
 * recall probability, which is available once a card has been reviewed at
 * least once before); falls back to the raw recent correct-rate when no
 * retrievability data exists yet (e.g. a brand-new set of first-time cards).
 * Returns `null` when there is no review history at all.
 */
export const retentionEstimate = (reviewLog: readonly ReviewLogEntry[], sampleSize = 50): number | null => {
  const recent = reviewLog.slice(-sampleSize)
  if (recent.length === 0) return null

  const withRetrievability = recent.filter(
    (entry): entry is ReviewLogEntry & { retrievabilityAtReview: number } => entry.retrievabilityAtReview !== null,
  )
  if (withRetrievability.length > 0) {
    const sum = withRetrievability.reduce((acc, entry) => acc + entry.retrievabilityAtReview, 0)
    return sum / withRetrievability.length
  }

  const correctCount = recent.filter((entry) => entry.correct).length
  return correctCount / recent.length
}
