import type { ZodType } from 'zod'
import type { SetId } from '../types'

/**
 * Generic per-mode, per-set "resume where you left off" storage. Deliberately
 * outside `AppState`/`appStateSchema` (../types) — same rationale as
 * `features/match/bestTime.ts`: ephemeral, non-critical, local-only UI
 * state (a queue position, not study material or FSRS scheduling), so it
 * doesn't need to round-trip through export/import or survive a schema
 * migration. Best-effort throughout — a lost resume just means the next
 * session starts fresh, never worth surfacing an error for.
 */

const resumeKey = (mode: string, setId: SetId): string => `seshat:session-resume:${mode}:${setId}`

export const saveResumeState = <T>(mode: string, setId: SetId, data: T): void => {
  try {
    window.localStorage.setItem(resumeKey(mode, setId), JSON.stringify(data))
  } catch {
    // localStorage unavailable/full — nothing to do, resume is a nice-to-have.
  }
}

/** Reads and validates stored resume state. `null` if absent, corrupt, or storage is unavailable. */
export const loadResumeState = <T>(mode: string, setId: SetId, schema: ZodType<T>): T | null => {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(resumeKey(mode, setId))
  } catch {
    return null
  }
  if (raw === null) return null

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch {
    return null
  }

  const result = schema.safeParse(parsedJson)
  return result.success ? result.data : null
}

export const clearResumeState = (mode: string, setId: SetId): void => {
  try {
    window.localStorage.removeItem(resumeKey(mode, setId))
  } catch {
    // ignore
  }
}
