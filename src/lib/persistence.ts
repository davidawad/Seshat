import { z } from 'zod'
import { type Result, DEFAULT_SETTINGS, type Settings, err, ok, settingsSchema } from '../types'
import { type KeybindingOverrides, sanitizeOverrides } from './keybindings'
import { parseSettingsPatch } from './settings-patch'

/**
 * The one place Seshat touches browser storage for app data. Two tiers:
 *
 * - **localStorage** holds everything (sets, cards, review history) — bulk
 *   data that must never be sent anywhere.
 * - A small **cookie mirror** holds ONLY plaintext settings and keybinding
 *   overrides (never study material). It is a recovery net, not a second
 *   source of truth: it is read only when localStorage has nothing (wiped
 *   site data that spared cookies, a fresh private window, unavailable
 *   storage), and every value read back is re-parsed through the same Zod
 *   schemas as the primary copy (parse, don't trust). Cookies are
 *   client-side only here — there is no server — but the browser would send
 *   them to any same-origin request, hence the tiny size budget.
 *
 * Everything below is non-throwing: storage can be blocked (private mode,
 * disabled cookies) and persistence is best-effort by design.
 */

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type StorageError =
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'quota-exceeded' }
  | { readonly kind: 'corrupt'; readonly message: string }
  | { readonly kind: 'write-failed'; readonly message: string }

// ---------------------------------------------------------------------------
// localStorage wrappers
// ---------------------------------------------------------------------------

export const isLocalStorageAvailable = (): boolean => {
  try {
    const probeKey = '__seshat_storage_probe__'
    window.localStorage.setItem(probeKey, '1')
    window.localStorage.removeItem(probeKey)
    return true
  } catch {
    return false
  }
}

/** The raw string under `key`, or `null` if absent OR storage is unavailable. */
export const readLocal = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * Writes `value` under `key`. A write of an identical value is skipped so
 * a hydrate-then-save echo between tabs converges instead of ping-ponging.
 */
export const writeLocal = (key: string, value: string): Result<void, StorageError> => {
  if (!isLocalStorageAvailable()) return err({ kind: 'unavailable' })
  try {
    if (window.localStorage.getItem(key) !== value) window.localStorage.setItem(key, value)
    return ok(undefined)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      return err({ kind: 'quota-exceeded' })
    }
    return err({ kind: 'write-failed', message: error instanceof Error ? error.message : 'unknown write error' })
  }
}

export const removeLocal = (key: string): void => {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // unavailable — nothing to remove.
  }
}

// ---------------------------------------------------------------------------
// Cookie mirror — pure encode/decode
// ---------------------------------------------------------------------------

export const SETTINGS_COOKIE = 'seshat_settings'
export const KEYBINDINGS_COOKIE = 'seshat_keys'

/** Encoded-value budget per cookie. Browsers allow ~4096 bytes per name+value+attributes; leave headroom. */
export const COOKIE_BUDGET = 3500

/** 400 days — the maximum Chrome honours, and browsers clamp anything longer. */
const COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60

/** `null` when the encoded form would blow the size budget (the mirror is then simply dropped). */
export const encodeCookieValue = (value: unknown): string | null => {
  const encoded = encodeURIComponent(JSON.stringify(value))
  return encoded.length > COOKIE_BUDGET ? null : encoded
}

/** The parsed JSON under an encoded cookie value, or `undefined` if malformed. */
export const decodeCookieValue = (encoded: string): unknown => {
  try {
    return JSON.parse(decodeURIComponent(encoded))
  } catch {
    return undefined
  }
}

/** Extracts one cookie's raw (still-encoded) value from a `document.cookie`-style header. */
export const parseCookieHeader = (header: string, name: string): string | null => {
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith(`${name}=`)) return trimmed.slice(name.length + 1)
  }
  return null
}

export interface CookieAttributes {
  readonly path: string
  readonly secure: boolean
  readonly maxAgeSeconds: number
}

export const buildCookie = (name: string, encodedValue: string, attributes: CookieAttributes): string =>
  `${name}=${encodedValue}; Path=${attributes.path}; Max-Age=${attributes.maxAgeSeconds}; SameSite=Lax${
    attributes.secure ? '; Secure' : ''
  }`

/**
 * Settings recovered from a mirror payload: only known, valid keys,
 * layered over defaults, then re-validated as a whole. `null` if the
 * payload isn't an object of valid settings at all.
 */
export const settingsFromMirror = (payload: unknown): Settings | null => {
  const patch = parseSettingsPatch(payload, { unknownKeys: 'ignore' })
  if (!patch.ok) return null
  const full = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...patch.value })
  return full.success ? full.data : null
}

/** Keybinding overrides recovered from a mirror payload, sanitized exactly like localStorage's copy. */
export const keybindingsFromMirror = (payload: unknown): KeybindingOverrides | null => {
  if (!z.record(z.string(), z.unknown()).safeParse(payload).success) return null
  return sanitizeOverrides(payload).overrides
}

// ---------------------------------------------------------------------------
// Cookie mirror — DOM wrappers
// ---------------------------------------------------------------------------

const cookieAttributes = (): CookieAttributes => ({
  path: import.meta.env.BASE_URL,
  secure: window.location.protocol === 'https:',
  maxAgeSeconds: COOKIE_MAX_AGE_SECONDS,
})

const readCookieRaw = (name: string): string | null => {
  try {
    return parseCookieHeader(document.cookie, name)
  } catch {
    return null
  }
}

/** Writes `value` (JSON-serializable) to cookie `name`; over-budget values remove the cookie instead. Never throws. */
const writeCookie = (name: string, value: unknown): void => {
  try {
    const encoded = encodeCookieValue(value)
    if (encoded === null) {
      clearCookie(name)
      return
    }
    // Skip identical rewrites — this runs on every state save.
    if (readCookieRaw(name) === encoded) return
    document.cookie = buildCookie(name, encoded, cookieAttributes())
  } catch {
    // cookies disabled — the mirror is a nice-to-have.
  }
}

const clearCookie = (name: string): void => {
  try {
    document.cookie = buildCookie(name, '', { ...cookieAttributes(), maxAgeSeconds: 0 })
  } catch {
    // nothing to clear.
  }
}

export const mirrorSettings = (settings: Settings): void => writeCookie(SETTINGS_COOKIE, settings)

export const mirrorKeybindings = (overrides: KeybindingOverrides): void => writeCookie(KEYBINDINGS_COOKIE, overrides)

export const clearMirrors = (): void => {
  clearCookie(SETTINGS_COOKIE)
  clearCookie(KEYBINDINGS_COOKIE)
}

/** Settings from the cookie mirror, or `null` if absent/malformed/invalid. */
export const readMirroredSettings = (): Settings | null => {
  const raw = readCookieRaw(SETTINGS_COOKIE)
  return raw === null ? null : settingsFromMirror(decodeCookieValue(raw))
}

/** Keybinding overrides from the cookie mirror, or `null` if absent/malformed. */
export const readMirroredKeybindings = (): KeybindingOverrides | null => {
  const raw = readCookieRaw(KEYBINDINGS_COOKIE)
  return raw === null ? null : keybindingsFromMirror(decodeCookieValue(raw))
}

// ---------------------------------------------------------------------------
// Cross-tab sync
// ---------------------------------------------------------------------------

/** Dispatched on `window` when a same-tab non-React writer (window.seshat) changed storage — `storage` events never fire in the writing tab itself. */
export const EXTERNAL_WRITE_EVENT = 'seshat:external-write'

export const notifyExternalWrite = (): void => {
  window.dispatchEvent(new Event(EXTERNAL_WRITE_EVENT))
}

/**
 * Calls `onChange` when `key` changes in ANOTHER tab (the `storage` event
 * only fires in non-writing tabs, so a tab's own saves can't loop back) or
 * when a same-tab scripted writer announces itself. `onChange` receives
 * the new raw value (`null` for external-write notifications, meaning
 * "re-read it"); key removals/`clear()` (`newValue === null`) are ignored.
 */
export const subscribeToKey = (key: string, onChange: (newValue: string | null) => void): (() => void) => {
  const onStorage = (event: StorageEvent) => {
    if (event.key === key && event.newValue !== null) onChange(event.newValue)
  }
  const onExternal = () => onChange(null)
  window.addEventListener('storage', onStorage)
  window.addEventListener(EXTERNAL_WRITE_EVENT, onExternal)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(EXTERNAL_WRITE_EVENT, onExternal)
  }
}

// ---------------------------------------------------------------------------
// Storage persistence
// ---------------------------------------------------------------------------

let persistenceRequested = false

/**
 * Asks the browser not to evict our storage under pressure. Called after
 * the first successful save; at most once per page load, feature-detected,
 * and fully guarded (old browsers, insecure contexts, and rejected
 * promises all collapse to a silent no-op).
 */
export const requestPersistenceOnce = (): void => {
  if (persistenceRequested) return
  persistenceRequested = true
  try {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage
    if (storage === undefined || typeof storage.persist !== 'function') return
    storage.persist().catch(() => {
      // denied or unsupported — best-effort.
    })
  } catch {
    // best-effort.
  }
}

/** Test seam: lets tests observe the once-per-load guard from a clean slate. */
export const resetPersistenceRequestForTests = (): void => {
  persistenceRequested = false
}
