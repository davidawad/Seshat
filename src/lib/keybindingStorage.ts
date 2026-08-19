import { type KeybindingOverrides, sanitizeOverrides } from './keybindings'

/**
 * Persists only the user's keybinding *overrides* (not the whole resolved
 * keymap) to `localStorage`, deliberately outside `AppState`/
 * `appStateSchema` (../types) — same rationale as `sessionResume.ts` and
 * `features/match/bestTime.ts`: ephemeral, non-critical, local-only UI
 * preference, not study material or scheduling state, so it doesn't need to
 * round-trip through the set export/import path or survive an `AppState`
 * schema migration. Best-effort throughout — a lost remap just means the
 * next session falls back to registry defaults, never worth surfacing an
 * error for. Parse-don't-trust on load, mirroring `lib/storage.ts`.
 */

const STORAGE_KEY = 'seshat:keybindings:v1'

/** Reads and validates stored keybinding overrides. `{}` (registry defaults only) if absent, corrupt, or storage is unavailable. */
export const loadKeybindingOverrides = (): KeybindingOverrides => {
  let raw: string | null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return {}
  }
  if (raw === null) return {}

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch {
    return {}
  }

  return sanitizeOverrides(parsedJson).overrides
}

export const saveKeybindingOverrides = (overrides: KeybindingOverrides): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch {
    // localStorage unavailable/full — nothing to do, remaps are a nice-to-have.
  }
}
