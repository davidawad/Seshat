import type { SetId } from '../../../types'

/**
 * Per-set personal-best SCORE for Blast, stored directly under its own
 * `localStorage` key — deliberately NOT part of `AppState`/`appStateSchema`
 * in ../../../types. It's ephemeral, non-critical, local-only data (an
 * arcade high score, not study material or scheduling state), so it doesn't
 * need to round-trip through export/import or survive a schema migration.
 * Follows match/bestTime.ts's exact pattern, kept as its own small module
 * per this codebase's convention of not sharing this kind of thing across
 * game features even though the shape rhymes.
 */

const bestScoreKey = (setId: SetId): string => `seshat:blast-best:${setId}`

/** Reads the stored personal-best score for a set. `null` if none yet, or if the stored value is missing/corrupt. */
export const getBestScore = (setId: SetId): number | null => {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(bestScoreKey(setId))
  } catch {
    return null
  }
  if (raw === null) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

/**
 * Records a completed run's score if it beats (or sets) the personal best
 * for that set. Returns the resulting best score — the new one if it won,
 * otherwise the previous one unchanged.
 */
export const recordScore = (setId: SetId, score: number): number => {
  const previousBest = getBestScore(setId)
  if (previousBest !== null && previousBest >= score) return previousBest
  try {
    window.localStorage.setItem(bestScoreKey(setId), String(score))
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — the run
    // still completed, we just can't persist a new best. Not worth
    // surfacing an error for what's a nice-to-have personal record.
  }
  return score
}
