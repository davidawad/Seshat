import {
  type AppState,
  APP_STATE_VERSION,
  LEGACY_APP_STATE_VERSION,
  type Result,
  appStateSchema,
  createEmptyAppState,
  err,
  legacyAppStateSchema,
  ok,
} from '../types'
import { backfillActivation } from './activation'
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
 * The entire app persists as a single JSON blob under one localStorage key —
 * text and MediaRefs only; image bytes live in IndexedDB (lib/media). No
 * backend, no database — see docs page for why. `loadState` never trusts
 * what it reads back; it always re-parses through the schema (parse, don't
 * validate), so a hand-edited or corrupted localStorage value fails loudly
 * instead of producing an app in an illegal state.
 *
 * Two keys exist during the v1 -> v2 image-storage migration (lib/media/
 * migrate.ts). `STORAGE_KEY` (v2) is the source of truth once it exists.
 * While it does not (the migration could not complete, so images are still
 * inline data URLs) the app runs from `LEGACY_STORAGE_KEY` (v1): reads parse
 * it into the same in-memory shape and saves go back to the v1 key in v1
 * form, so the migration can retry on the next boot with the latest data and
 * nothing is ever written to v2 by a tab that is not the migrator.
 *
 * All raw browser storage goes through `./persistence`. Settings (only
 * settings) are additionally mirrored to a small cookie on every save, and
 * hydrate a fresh state when localStorage has no app state — see that
 * module for the rationale and the size budget.
 */

export const STORAGE_KEY = 'seshat:app-state:v2'
export const LEGACY_STORAGE_KEY = 'seshat:app-state:v1'

export type { StorageError }

/** An empty state whose settings come from the cookie mirror when one exists. */
const emptyStateFromMirror = (): AppState => {
  const settings = readMirroredSettings()
  const empty = createEmptyAppState()
  return settings === null ? empty : { ...empty, settings }
}

const parseJson = (raw: string): Result<unknown, StorageError> => {
  try {
    return ok(JSON.parse(raw))
  } catch (error) {
    return err({ kind: 'corrupt', message: error instanceof Error ? error.message : 'invalid JSON' })
  }
}

const parseWith =
  (schema: typeof appStateSchema | typeof legacyAppStateSchema) =>
  (raw: string): Result<AppState, StorageError> => {
    const json = parseJson(raw)
    if (!json.ok) return json
    const result = schema.safeParse(json.value)
    if (!result.success) return err({ kind: 'corrupt', message: result.error.message })
    // Legacy and current share one in-memory shape; only the envelope version differs.
    return ok(backfillActivation({ ...result.data, version: APP_STATE_VERSION }))
  }

/** Parses a raw v2 blob (also used by the cross-tab listener). */
export const parseState = parseWith(appStateSchema)
/** Parses a raw v1 blob into the current in-memory shape (inline data URLs are kept as-is). */
export const parseLegacyState = parseWith(legacyAppStateSchema)

/** Which key the app is currently reading from / writing to (see the module comment). */
type Source = 'v2' | 'v1'
let source: Source = 'v2'

/** Test seam: forget which key the last load came from. */
export const resetStorageSourceForTests = (): void => {
  source = 'v2'
}

const loadLegacy = (): Result<AppState, StorageError> | null => {
  const raw = readLocal(LEGACY_STORAGE_KEY)
  return raw === null ? null : parseLegacyState(raw)
}

export const loadState = (): Result<AppState, StorageError> => {
  if (!isLocalStorageAvailable()) return err({ kind: 'unavailable' })

  const raw = readLocal(STORAGE_KEY)
  const current = raw === null ? null : parseState(raw)
  if (current?.ok === true) {
    source = 'v2'
    return current
  }
  // No usable v2: fall back to the untouched v1 copy rather than lose it.
  const legacy = loadLegacy()
  if (legacy?.ok === true) {
    source = 'v1'
    return legacy
  }
  source = 'v2'
  return current ?? legacy ?? ok(emptyStateFromMirror())
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

/** Running on the v1 key (migration pending): keep writing v1, unless another tab has since migrated. */
const saveLegacy = (state: AppState): Result<void, StorageError> => {
  const v2 = readLocal(STORAGE_KEY)
  if (v2 !== null && parseState(v2).ok) {
    return err({ kind: 'write-failed', message: 'Another tab upgraded your data; reload this tab to continue.' })
  }
  return writeLocal(LEGACY_STORAGE_KEY, JSON.stringify({ ...state, version: LEGACY_APP_STATE_VERSION }))
}

export const saveState = (state: AppState): Result<void, StorageError> => {
  // Mirrored first and unconditionally: the cookie is exactly the thing
  // that should still work when localStorage doesn't.
  mirrorSettings(state.settings)
  const result = source === 'v1' ? saveLegacy(state) : writeLocal(STORAGE_KEY, JSON.stringify(state))
  if (result.ok) requestPersistenceOnce()
  return result
}

/** Removes the app state (both keys). */
export const clearState = (): void => {
  removeLocal(STORAGE_KEY)
  removeLocal(LEGACY_STORAGE_KEY)
}

/**
 * Calls `onState` with the new app state when another tab saves (via the
 * `storage` event) or a same-tab scripted writer (`window.seshat`)
 * announces a write. A tab's own `saveState` triggers neither, so
 * subscribing cannot create a write loop; invalid incoming data is ignored.
 * Both keys are watched: a tab still on v1 adopts v2 the moment another tab
 * finishes migrating, and v1 writes only matter while this tab is on v1.
 */
export const subscribeToAppState = (onState: (state: AppState) => void): (() => void) => {
  const onV2 = (newValue: string | null) => {
    const result = newValue === null ? loadState() : parseState(newValue)
    if (!result.ok) return
    source = 'v2'
    onState(result.value)
  }
  const onV1 = (newValue: string | null) => {
    if (source !== 'v1') return
    const result = newValue === null ? loadState() : parseLegacyState(newValue)
    if (result.ok) onState(result.value)
  }
  const stopV2 = subscribeToKey(STORAGE_KEY, onV2)
  const stopV1 = subscribeToKey(LEGACY_STORAGE_KEY, onV1)
  return () => {
    stopV2()
    stopV1()
  }
}
