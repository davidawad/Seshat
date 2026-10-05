import { describe, expect, it } from 'vitest'
import {
  backfillActivation,
  daysBetween,
  formatDuration,
  localDay,
  recordBackupDownloaded,
  recordNudgeDismissed,
  recordReviewUndone,
  recordReviewed,
  recordSetAdded,
  shouldShowBackupNudge,
  timeToFirstGradedMs,
} from './activation'
import { parseState } from './storage'
import {
  type Activation,
  type ReviewLogEntry,
  cardIdSchema,
  createEmptyActivation,
  createEmptyAppState,
  setIdSchema,
} from '../types'

// Local-noon timestamps so the local calendar day is unambiguous in any timezone.
const noon = (day: number): string => new Date(2026, 0, day, 12, 0, 0).toISOString()
const empty = createEmptyActivation()

describe('day helpers', () => {
  it('reads the local calendar day and counts whole days', () => {
    expect(localDay(noon(5))).toBe('2026-01-05')
    expect(daysBetween('2026-01-05', '2026-01-06')).toBe(1)
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
  })
})

describe('recordSetAdded', () => {
  it('keeps the first set and its source; later sets do not overwrite them', () => {
    const a = recordSetAdded(recordSetAdded(empty, 'sample', noon(1)), 'create', noon(2))
    expect(a).toMatchObject({ firstSetAt: noon(1), firstSetSource: 'sample', firstRealSetAt: noon(2) })
  })

  it('does not arm the backup reminder for the sample', () => {
    expect(recordSetAdded(empty, 'sample', noon(1)).firstRealSetAt).toBeNull()
    expect(recordSetAdded(empty, 'import', noon(1))).toMatchObject({
      firstSetSource: 'import',
      firstRealSetAt: noon(1),
    })
  })
})

describe('recordReviewed', () => {
  it('counts reviews, the first graded time and distinct study days', () => {
    const start = recordSetAdded(empty, 'create', noon(1))
    const a = [noon(1), noon(1), noon(3)].reduce(recordReviewed, start)
    expect(a).toMatchObject({ totalReviews: 3, daysStudied: 2, firstGradedAt: noon(1), lastStudyDay: '2026-01-03' })
    expect(timeToFirstGradedMs(a)).toBe(0)
  })

  it('flags a return on day 2 and day 7 only on those exact days', () => {
    const start = recordSetAdded(empty, 'create', noon(1))
    const d2 = recordReviewed(start, noon(2))
    expect(d2).toMatchObject({ day2Return: true, day7Return: false })
    expect(recordReviewed(start, noon(3))).toMatchObject({ day2Return: false, day7Return: false })
    expect(recordReviewed(d2, noon(7)).day7Return).toBe(true)
    expect(recordReviewed(d2, noon(8)).day7Return).toBe(false)
  })

  it('never sets the flags without a first set', () => {
    expect(recordReviewed(empty, noon(2))).toMatchObject({ day2Return: false, day7Return: false })
  })

  it('an undone review lowers the total but not below zero', () => {
    const a = recordReviewed(empty, noon(1))
    expect(recordReviewUndone(a).totalReviews).toBe(0)
    expect(recordReviewUndone(recordReviewUndone(a)).totalReviews).toBe(0)
    expect(recordReviewUndone(a).firstGradedAt).toBe(noon(1))
  })
})

describe('timeToFirstGradedMs and formatDuration', () => {
  it('is null until a set and a graded card both exist', () => {
    expect(timeToFirstGradedMs(empty)).toBeNull()
    expect(timeToFirstGradedMs(recordSetAdded(empty, 'create', noon(1)))).toBeNull()
  })

  it('measures set-to-first-grade and phrases it coarsely', () => {
    const a: Activation = {
      ...empty,
      firstSetAt: '2026-01-01T10:00:00.000Z',
      firstGradedAt: '2026-01-01T10:12:30.000Z',
    }
    expect(timeToFirstGradedMs(a)).toBe(750_000)
    expect(formatDuration(30_000)).toBe('under a minute')
    expect(formatDuration(60_000)).toBe('1 minute')
    expect(formatDuration(750_000)).toBe('12 minutes')
    expect(formatDuration(3 * 3_600_000)).toBe('3 hours')
    expect(formatDuration(72 * 3_600_000)).toBe('3 days')
  })
})

describe('shouldShowBackupNudge', () => {
  const armed = recordSetAdded(empty, 'create', noon(1))
  const day = (n: number) => new Date(2026, 0, n, 12)

  it('is off with no real set (including after only the sample), or when the setting is off', () => {
    expect(shouldShowBackupNudge(empty, day(1), true)).toBe(false)
    expect(shouldShowBackupNudge(recordSetAdded(empty, 'sample', noon(1)), day(1), true)).toBe(false)
    expect(shouldShowBackupNudge(armed, day(1), false)).toBe(false)
  })

  it('shows after the first real set until a backup or dismissal', () => {
    expect(shouldShowBackupNudge(armed, day(1), true)).toBe(true)
  })

  it('a backup hides it, and it returns after 30 days', () => {
    const a = recordBackupDownloaded(armed, noon(1))
    expect(shouldShowBackupNudge(a, day(2), true)).toBe(false)
    expect(shouldShowBackupNudge(a, day(30), true)).toBe(false)
    expect(shouldShowBackupNudge(a, day(31), true)).toBe(true)
  })

  it('returns after 50 more reviews than at the last backup', () => {
    const base = recordBackupDownloaded({ ...armed, totalReviews: 10 }, noon(1))
    expect(shouldShowBackupNudge({ ...base, totalReviews: 59 }, day(2), true)).toBe(false)
    expect(shouldShowBackupNudge({ ...base, totalReviews: 60 }, day(2), true)).toBe(true)
  })

  it('a dismissal hides it and restarts the schedule from the dismissal', () => {
    const a = recordNudgeDismissed({ ...armed, totalReviews: 5 }, noon(1))
    expect(shouldShowBackupNudge(a, day(2), true)).toBe(false)
    expect(shouldShowBackupNudge({ ...a, totalReviews: 55 }, day(2), true)).toBe(true)
    expect(shouldShowBackupNudge(a, day(31), true)).toBe(true)
  })

  it('measures from whichever of backup and dismissal is later', () => {
    const a = recordNudgeDismissed(recordBackupDownloaded(armed, noon(1)), noon(20))
    expect(shouldShowBackupNudge(a, day(40), true)).toBe(false)
    expect(shouldShowBackupNudge(a, day(51), true)).toBe(true)
  })
})

describe('backfillActivation', () => {
  const setId = setIdSchema.parse('a1111111-1111-4111-8111-111111111111')
  const review = (reviewedAt: string): ReviewLogEntry => ({
    cardId: cardIdSchema.parse('c1111111-1111-4111-8111-111111111111'),
    setId,
    reviewedAt,
    grade: 'good',
    confidence: null,
    correct: true,
    retrievabilityAtReview: null,
    elapsedMs: 1,
    selfExplanation: null,
  })
  const withData = () => ({
    ...createEmptyAppState(),
    sets: [{ id: setId, name: 'S', description: '', tags: [], createdAt: noon(1), updatedAt: noon(1), goalDate: null }],
    reviewLog: [review(noon(2)), review(noon(2)), review(noon(7))],
  })

  it('leaves an empty state alone', () => {
    const state = createEmptyAppState()
    expect(backfillActivation(state)).toBe(state)
  })

  it('rebuilds the metrics from existing sets and reviews', () => {
    expect(backfillActivation(withData()).activation).toMatchObject({
      firstSetAt: noon(1),
      firstSetSource: null,
      firstRealSetAt: noon(1),
      firstGradedAt: noon(2),
      totalReviews: 3,
      daysStudied: 2,
      day2Return: true,
      day7Return: true,
    })
  })

  it('is idempotent', () => {
    const once = backfillActivation(withData())
    expect(backfillActivation(once)).toBe(once)
  })

  it('applies when an old saved state without the activation field loads', () => {
    const { activation: _drop, ...old } = withData()
    const parsed = parseState(JSON.stringify(old))
    expect(parsed.ok && parsed.value.activation).toMatchObject({ totalReviews: 3, daysStudied: 2 })
  })

  it('an old saved state without the new setting loads with the reminder on', () => {
    const { activation: _drop, ...old } = createEmptyAppState()
    const { backupRemindersEnabled: _x, ...settings } = old.settings
    const parsed = parseState(JSON.stringify({ ...old, settings }))
    expect(parsed.ok && parsed.value.settings.backupRemindersEnabled).toBe(true)
  })
})
