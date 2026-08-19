import type { SetId } from '../../types'

/**
 * Per-set personal-best time for Match mode, stored directly under its own
 * `localStorage` key — deliberately NOT part of `AppState`/`appStateSchema`
 * in ../../types. It's ephemeral, non-critical, local-only data (a timer
 * result, not study material or scheduling state), so it doesn't need to
 * round-trip through export/import or survive a schema migration. This is
 * the one place in Match mode allowed to touch `localStorage` directly.
 */

// Keyed by pairCap too, not just setId — a "best" is only meaningful
// against a fixed round size (a 6-pair round is trivially faster than a
// 16-pair one), so different round sizes must not share one record.
const bestTimeKey = (setId: SetId, pairCap: number): string => `seshat:match-best:${setId}:${pairCap}`

/** Reads the stored personal-best time for a set at a given round size, in milliseconds. `null` if none yet, or if the stored value is missing/corrupt. */
export const getBestTimeMs = (setId: SetId, pairCap: number): number | null => {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(bestTimeKey(setId, pairCap))
  } catch {
    return null
  }
  if (raw === null) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/**
 * Records a completed round's time if it beats (or sets) the personal best
 * for that round size. Returns the resulting best time — the new one if it
 * won, otherwise the previous one unchanged.
 */
export const recordCompletionTime = (setId: SetId, pairCap: number, elapsedMs: number): number => {
  const previousBest = getBestTimeMs(setId, pairCap)
  if (previousBest !== null && previousBest <= elapsedMs) return previousBest
  try {
    window.localStorage.setItem(bestTimeKey(setId, pairCap), String(elapsedMs))
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — the round
    // still completed, we just can't persist a new best. Not worth
    // surfacing an error for what's a nice-to-have personal record.
  }
  return elapsedMs
}

/** Formats a millisecond duration as e.g. "12.3s" for display. */
export const formatElapsed = (ms: number): string => `${(ms / 1000).toFixed(1)}s`
