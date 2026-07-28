import { type AppState, type Result, appStateSchema, createEmptyAppState, err, ok } from '../types'

/**
 * The entire app persists as a single JSON blob under one localStorage key.
 * No backend, no database — see docs page for why. `loadState` never trusts
 * what it reads back; it always re-parses through `appStateSchema` (parse,
 * don't validate), so a hand-edited or corrupted localStorage value fails
 * loudly instead of producing an app in an illegal state.
 */

export const STORAGE_KEY = 'seshat:app-state:v1'

export type StorageError =
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'quota-exceeded' }
  | { readonly kind: 'corrupt'; readonly message: string }
  | { readonly kind: 'write-failed'; readonly message: string }

const isStorageAvailable = (): boolean => {
  try {
    const probeKey = '__seshat_storage_probe__'
    window.localStorage.setItem(probeKey, '1')
    window.localStorage.removeItem(probeKey)
    return true
  } catch {
    return false
  }
}

export const loadState = (): Result<AppState, StorageError> => {
  if (!isStorageAvailable()) return err({ kind: 'unavailable' })

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === null) return ok(createEmptyAppState())

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

export const saveState = (state: AppState): Result<void, StorageError> => {
  if (!isStorageAvailable()) return err({ kind: 'unavailable' })

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return ok(undefined)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      return err({ kind: 'quota-exceeded' })
    }
    return err({ kind: 'write-failed', message: error instanceof Error ? error.message : 'unknown write error' })
  }
}

export const clearState = (): void => {
  window.localStorage.removeItem(STORAGE_KEY)
}
