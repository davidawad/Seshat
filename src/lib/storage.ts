import { type AppState, type Result, appStateSchema, createEmptyAppState, err, ok } from '../types'
import {
  type StorageError,
  isLocalStorageAvailable,
  mirrorSettings,
  readLocal,
  readMirroredSettings,
  removeLocal,
  requestPersistenceOnce,
  subscribeToKey,
  writeLocal,
} from './persistence'

/**
 * The entire app persists as a single JSON blob under one localStorage key.
 * No backend, no database — see docs page for why. `loadState` never trusts
 * what it reads back; it always re-parses through `appStateSchema` (parse,
 * don't validate), so a hand-edited or corrupted localStorage value fails
 * loudly instead of producing an app in an illegal state.
 *
 * All raw browser storage goes through `./persistence`. Settings (only
 * settings) are additionally mirrored to a small cookie on every save, and
 * hydrate a fresh state when localStorage has no app state — see that
 * module for the rationale and the size budget.
 */

export const STORAGE_KEY = 'seshat:app-state:v1'

export type { StorageError }

/** An empty state whose settings come from the cookie mirror when one exists. */
const emptyStateFromMirror = (): AppState => {
  const settings = readMirroredSettings()
  const empty = createEmptyAppState()
  return settings === null ? empty : { ...empty, settings }
}

const parseState = (raw: string): Result<AppState, StorageError> => {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch (error) {
    return err({ kind: 'corrupt', message: error instanceof Error ? error.message : 'invalid JSON' })
  }

  const result = appStateSchema.safeParse(parsedJson)
  if (!result.success) {
    return err({ kind: 'corrupt', message: result.error.message })
  }
  return ok(result.data)
}

export const loadState = (): Result<AppState, StorageError> => {
  if (!isLocalStorageAvailable()) return err({ kind: 'unavailable' })

  const raw = readLocal(STORAGE_KEY)
  return raw === null ? ok(emptyStateFromMirror()) : parseState(raw)
}

/**
 * What the app boots with: the stored state if it loads, otherwise an
 * empty state that still carries the user's mirrored settings (covers
 * unavailable AND corrupt localStorage — their preferences survive both).
 */
export const loadInitialState = (): AppState => {
  const result = loadState()
  return result.ok ? result.value : emptyStateFromMirror()
}

export const saveState = (state: AppState): Result<void, StorageError> => {
  // Mirrored first and unconditionally: the cookie is exactly the thing
  // that should still work when localStorage doesn't.
  mirrorSettings(state.settings)
  const result = writeLocal(STORAGE_KEY, JSON.stringify(state))
  if (result.ok) requestPersistenceOnce()
  return result
}

export const clearState = (): void => {
  removeLocal(STORAGE_KEY)
}

/**
 * Calls `onState` with the new app state when another tab saves (via the
 * `storage` event) or a same-tab scripted writer (`window.seshat`)
 * announces a write. A tab's own `saveState` triggers neither, so
 * subscribing cannot create a write loop; invalid incoming data is ignored.
 */
export const subscribeToAppState = (onState: (state: AppState) => void): (() => void) =>
  subscribeToKey(STORAGE_KEY, (newValue) => {
    const result = newValue === null ? loadState() : parseState(newValue)
    if (result.ok) onState(result.value)
  })
