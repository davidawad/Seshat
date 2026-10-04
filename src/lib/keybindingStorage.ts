import { type KeybindingOverrides, sanitizeOverrides } from './keybindings'
import { mirrorKeybindings, readLocal, readMirroredKeybindings, subscribeToKey, writeLocal } from './persistence'

/**
 * Persists only the user's keybinding *overrides* (not the whole resolved
 * keymap) to `localStorage`, deliberately outside `AppState`/
 * `appStateSchema` (../types) — same rationale as `sessionResume.ts` and
 * `features/match/bestTime.ts`: ephemeral, non-critical, local-only UI
 * preference, not study material or scheduling state, so it doesn't need to
 * round-trip through the set export/import path or survive an `AppState`
 * schema migration. Best-effort throughout — a lost remap just means the
 * next session falls back to registry defaults, never worth surfacing an
 * error for. Parse-don't-trust on load, mirroring `lib/storage.ts`. Like
 * settings, overrides are mirrored to a small cookie (see `./persistence`)
 * and fall back to it when localStorage has no copy.
 */

export const KEYBINDINGS_STORAGE_KEY = 'seshat:keybindings:v1'

/** Reads and validates stored keybinding overrides. `{}` (registry defaults only) if absent, corrupt, or storage is unavailable. */
export const loadKeybindingOverrides = (): KeybindingOverrides => {
  const raw = readLocal(KEYBINDINGS_STORAGE_KEY)
  if (raw === null) return readMirroredKeybindings() ?? {}

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch {
    return {}
  }

  return sanitizeOverrides(parsedJson).overrides
}

export const saveKeybindingOverrides = (overrides: KeybindingOverrides): void => {
  // Result deliberately ignored: localStorage unavailable/full just means
  // remaps are lost next session — a nice-to-have, never worth an error.
  writeLocal(KEYBINDINGS_STORAGE_KEY, JSON.stringify(overrides))
  mirrorKeybindings(overrides)
}

/** Calls `onChange` with the new overrides when another tab (or a scripted writer) changes them. */
export const subscribeToKeybindingOverrides = (onChange: (overrides: KeybindingOverrides) => void): (() => void) =>
  subscribeToKey(KEYBINDINGS_STORAGE_KEY, () => onChange(loadKeybindingOverrides()))
