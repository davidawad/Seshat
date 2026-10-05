import type { Activation, AppState, FirstSetSource } from '../types'

/**
 * Local-only activation metrics and the backup-reminder schedule. Pure functions over the
 * `Activation` record kept in the app state; nothing here reads the clock, touches storage or the
 * network (Seshat has no telemetry: these numbers exist only to show the learner their own first
 * week and to decide when to remind them that their cards live on this device alone).
 */

const DAY_MS = 86_400_000
/** The backup banner returns after this long without a backup or dismissal... */
export const BACKUP_NUDGE_DAYS = 30
/** ...or after this many reviews since then. */
export const BACKUP_NUDGE_REVIEWS = 50

const pad = (n: number): string => String(n).padStart(2, '0')

/** The local calendar day of an instant, YYYY-MM-DD. */
export const localDay = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Whole calendar days from `from` to `to` (both YYYY-MM-DD); DST-safe because both are read as UTC midnights. */
export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)

export const recordSetAdded = (a: Activation, source: FirstSetSource, at: string): Activation => ({
  ...a,
  firstSetAt: a.firstSetAt ?? at,
  firstSetSource: a.firstSetAt === null ? source : a.firstSetSource,
  firstRealSetAt: a.firstRealSetAt ?? (source === 'sample' ? null : at),
})

export const recordReviewed = (a: Activation, at: string): Activation => {
  const day = localDay(at)
  const newDay = a.lastStudyDay !== day
  const sinceFirstSet = a.firstSetAt === null ? null : daysBetween(localDay(a.firstSetAt), day)
  return {
    ...a,
    firstGradedAt: a.firstGradedAt ?? at,
    totalReviews: a.totalReviews + 1,
    daysStudied: newDay ? a.daysStudied + 1 : a.daysStudied,
    lastStudyDay: day,
    day2Return: a.day2Return || sinceFirstSet === 1,
    day7Return: a.day7Return || sinceFirstSet === 6,
  }
}

/** An undone review no longer counts toward the total (the first-graded/day facts stay: they happened). */
export const recordReviewUndone = (a: Activation): Activation => ({
  ...a,
  totalReviews: Math.max(0, a.totalReviews - 1),
})

export const recordBackupDownloaded = (a: Activation, at: string): Activation => ({
  ...a,
  lastBackupAt: at,
  reviewsAtLastBackup: a.totalReviews,
})

export const recordNudgeDismissed = (a: Activation, at: string): Activation => ({
  ...a,
  nudgeDismissedAt: at,
  reviewsAtNudgeDismissal: a.totalReviews,
})

const later = (a: string | null, b: string | null): string | null => (a === null ? b : b === null ? a : a >= b ? a : b)

/**
 * Whether to show the backup banner: a real (non-sample) set has been saved, and either nothing
 * has yet been backed up or dismissed, or the latest backup/dismissal is 30+ days old or 50+
 * reviews behind. A backup or a dismissal both restart the schedule.
 */
export const shouldShowBackupNudge = (a: Activation, now: Date, remindersEnabled: boolean): boolean => {
  if (!remindersEnabled || a.firstRealSetAt === null) return false
  const anchorAt = later(a.lastBackupAt, a.nudgeDismissedAt)
  if (anchorAt === null) return true
  const anchorReviews = anchorAt === a.lastBackupAt ? a.reviewsAtLastBackup : a.reviewsAtNudgeDismissal
  const ageDays = (now.getTime() - Date.parse(anchorAt)) / DAY_MS
  return ageDays >= BACKUP_NUDGE_DAYS || a.totalReviews - anchorReviews >= BACKUP_NUDGE_REVIEWS
}

/** Milliseconds from the first set to the first graded card; null until both exist. */
export const timeToFirstGradedMs = (a: Activation): number | null =>
  a.firstSetAt === null || a.firstGradedAt === null
    ? null
    : Math.max(0, Date.parse(a.firstGradedAt) - Date.parse(a.firstSetAt))

/** "under a minute", "12 minutes", "3 hours", "2 days": coarse on purpose. */
export const formatDuration = (ms: number): string => {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'under a minute'
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
  if (minutes < 60) return plural(minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  return hours < 48 ? plural(hours, 'hour') : plural(Math.floor(hours / 24), 'day')
}

/**
 * Rebuilds activation from existing data, for state saved before activation existed (or written
 * by a script that cannot record it). Idempotent: a state that already has activation is returned
 * untouched. Existing sets count as real, so someone with data and no backup is reminded once.
 */
export const backfillActivation = (state: AppState): AppState => {
  const a = state.activation
  const hasHistory = state.sets.length > 0 || state.reviewLog.length > 0
  if (!hasHistory || a.firstSetAt !== null || a.totalReviews > 0) return state
  const firstSetAt = state.sets.map((s) => s.createdAt).sort()[0] ?? null
  const reviews = state.reviewLog.map((r) => r.reviewedAt).sort()
  const days = [...new Set(reviews.map(localDay))].sort()
  const firstDay = firstSetAt === null ? null : localDay(firstSetAt)
  const reviewedOn = (offset: number) => firstDay !== null && days.some((d) => daysBetween(firstDay, d) === offset)
  return {
    ...state,
    activation: {
      ...a,
      firstSetAt,
      firstRealSetAt: firstSetAt,
      firstGradedAt: reviews[0] ?? null,
      totalReviews: reviews.length,
      daysStudied: days.length,
      lastStudyDay: days.at(-1) ?? null,
      day2Return: reviewedOn(1),
      day7Return: reviewedOn(6),
    },
  }
}
