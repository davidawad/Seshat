import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../types'
import {
  COOKIE_BUDGET,
  EXTERNAL_WRITE_EVENT,
  KEYBINDINGS_COOKIE,
  SETTINGS_COOKIE,
  buildCookie,
  clearMirrors,
  decodeCookieValue,
  encodeCookieValue,
  isLocalStorageAvailable,
  keybindingsFromMirror,
  mirrorKeybindings,
  mirrorSettings,
  notifyExternalWrite,
  parseCookieHeader,
  readLocal,
  readMirroredKeybindings,
  readMirroredSettings,
  removeLocal,
  requestPersistenceOnce,
  resetPersistenceRequestForTests,
  settingsFromMirror,
  subscribeToKey,
  writeLocal,
} from './persistence'

const wipeCookies = () => clearMirrors()

describe('cookie encoding', () => {
  it('round-trips JSON through the encoded form', () => {
    const encoded = encodeCookieValue({ theme: 'dark', note: 'a; b=c' })
    expect(encoded).not.toBeNull()
    expect(encoded).not.toMatch(/[;\s]/)
    expect(decodeCookieValue(encoded ?? '')).toEqual({ theme: 'dark', note: 'a; b=c' })
  })

  it('returns null when over the size budget', () => {
    expect(encodeCookieValue({ blob: 'x'.repeat(COOKIE_BUDGET) })).toBeNull()
  })

  it('decodes malformed values to undefined instead of throwing', () => {
    expect(decodeCookieValue('%E0%A4%A')).toBeUndefined()
    expect(decodeCookieValue('not-json')).toBeUndefined()
  })

  it('finds a cookie by exact name in a header', () => {
    expect(parseCookieHeader('a=1; seshat_settings=xyz; b=2', 'seshat_settings')).toBe('xyz')
    expect(parseCookieHeader('a=1; xseshat_settings=xyz', 'seshat_settings')).toBeNull()
    expect(parseCookieHeader('', 'a')).toBeNull()
  })

  it('builds a SameSite=Lax cookie, Secure only when asked', () => {
    const attrs = { path: '/seshat/', maxAgeSeconds: 10, secure: false }
    expect(buildCookie('n', 'v', attrs)).toBe('n=v; Path=/seshat/; Max-Age=10; SameSite=Lax')
    expect(buildCookie('n', 'v', { ...attrs, secure: true })).toBe(
      'n=v; Path=/seshat/; Max-Age=10; SameSite=Lax; Secure',
    )
  })
})

describe('mirror payload parsing', () => {
  it('layers a partial settings payload over defaults', () => {
    expect(settingsFromMirror({ theme: 'dark' })).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark' })
  })

  it('a theme-only payload leaves every other setting at its stored value', () => {
    const out = settingsFromMirror({ theme: 'light' })
    expect(out).toEqual({ ...DEFAULT_SETTINGS, theme: 'light' })
    expect(out?.palette).toBe(DEFAULT_SETTINGS.palette)
    expect(out?.flashcardsFront).toBe(DEFAULT_SETTINGS.flashcardsFront)
  })

  it('ignores unknown keys instead of failing', () => {
    expect(settingsFromMirror({ theme: 'dark', bogus: 1 })).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark' })
  })

  it('rejects settings with invalid values or non-objects', () => {
    expect(settingsFromMirror({ theme: 'neon' })).toBeNull()
    expect(settingsFromMirror('dark')).toBeNull()
    expect(settingsFromMirror(null)).toBeNull()
  })

  it('sanitizes keybinding payloads and rejects non-records', () => {
    expect(keybindingsFromMirror({ 'flashcards.flip': 'enter', 'bogus.id': 'x' })).toEqual({
      'flashcards.flip': 'Enter',
    })
    expect(keybindingsFromMirror([1])).toBeNull()
    expect(keybindingsFromMirror('x')).toBeNull()
  })
})

describe('cookie mirror (DOM)', () => {
  beforeEach(wipeCookies)
  afterEach(() => {
    vi.restoreAllMocks()
    wipeCookies()
  })

  it('writes and reads settings', () => {
    mirrorSettings({ ...DEFAULT_SETTINGS, theme: 'dark' })
    expect(document.cookie).toContain(`${SETTINGS_COOKIE}=`)
    expect(readMirroredSettings()).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark' })
  })

  it('writes and reads keybinding overrides', () => {
    mirrorKeybindings({ 'flashcards.flip': 'Enter' })
    expect(readMirroredKeybindings()).toEqual({ 'flashcards.flip': 'Enter' })
  })

  it('skips rewriting an identical value', () => {
    mirrorSettings(DEFAULT_SETTINGS)
    const setter = vi.spyOn(document, 'cookie', 'set')
    mirrorSettings(DEFAULT_SETTINGS)
    expect(setter).not.toHaveBeenCalled()
  })

  it('drops the mirror when the payload exceeds the budget', () => {
    mirrorKeybindings({ 'flashcards.flip': 'Enter' })
    mirrorKeybindings({ big: 'x'.repeat(COOKIE_BUDGET * 2) })
    expect(document.cookie).not.toContain(KEYBINDINGS_COOKIE)
  })

  it('reads null when absent or tampered with', () => {
    expect(readMirroredSettings()).toBeNull()
    expect(readMirroredKeybindings()).toBeNull()
    document.cookie = `${SETTINGS_COOKIE}=${encodeURIComponent('{"theme":"neon"}')}; Path=/`
    expect(readMirroredSettings()).toBeNull()
  })

  it('never throws when cookies are unusable', () => {
    vi.spyOn(document, 'cookie', 'set').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(document, 'cookie', 'get').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => mirrorSettings(DEFAULT_SETTINGS)).not.toThrow()
    expect(() => clearMirrors()).not.toThrow()
    expect(readMirroredSettings()).toBeNull()
  })
})

describe('localStorage wrappers', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('reads, writes and removes', () => {
    expect(isLocalStorageAvailable()).toBe(true)
    expect(writeLocal('k', 'v').ok).toBe(true)
    expect(readLocal('k')).toBe('v')
    removeLocal('k')
    expect(readLocal('k')).toBeNull()
  })

  it('does not rewrite an identical value', () => {
    writeLocal('k', 'v')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    writeLocal('k', 'v')
    // only the availability probe writes; the value itself is untouched
    expect(setItem).not.toHaveBeenCalledWith('k', 'v')
  })

  it('reports unavailable storage without throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(isLocalStorageAvailable()).toBe(false)
    expect(writeLocal('k', 'v')).toEqual({ ok: false, error: { kind: 'unavailable' } })
    expect(readLocal('k')).toBeNull()
    expect(() => removeLocal('k')).not.toThrow()
  })

  it('maps quota and other write failures', () => {
    const real = Storage.prototype.setItem
    const failWith = (error: unknown) =>
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
        if (key.startsWith('__seshat')) return real.call(this, key, value)
        throw error
      })
    failWith(new DOMException('full', 'QuotaExceededError'))
    expect(writeLocal('k', 'v')).toEqual({ ok: false, error: { kind: 'quota-exceeded' } })
    vi.restoreAllMocks()
    failWith(new Error('boom'))
    expect(writeLocal('k', 'v')).toEqual({ ok: false, error: { kind: 'write-failed', message: 'boom' } })
    vi.restoreAllMocks()
    failWith('weird')
    expect(writeLocal('k', 'v')).toEqual({ ok: false, error: { kind: 'write-failed', message: 'unknown write error' } })
  })
})

describe('subscribeToKey', () => {
  it('fires for other-tab changes to its key only, and for external writes', () => {
    const onChange = vi.fn()
    const stop = subscribeToKey('k', onChange)
    window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: 'x' }))
    window.dispatchEvent(new StorageEvent('storage', { key: 'k', newValue: null }))
    expect(onChange).not.toHaveBeenCalled()
    window.dispatchEvent(new StorageEvent('storage', { key: 'k', newValue: 'new' }))
    expect(onChange).toHaveBeenLastCalledWith('new')
    notifyExternalWrite()
    expect(onChange).toHaveBeenLastCalledWith(null)
    expect(onChange).toHaveBeenCalledTimes(2)
    stop()
    window.dispatchEvent(new Event(EXTERNAL_WRITE_EVENT))
    expect(onChange).toHaveBeenCalledTimes(2)
  })
})

describe('requestPersistenceOnce', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'storage')
  beforeEach(resetPersistenceRequestForTests)
  afterEach(() => {
    if (original === undefined) Reflect.deleteProperty(navigator, 'storage')
    else Object.defineProperty(navigator, 'storage', original)
  })

  const stubStorage = (value: unknown) => Object.defineProperty(navigator, 'storage', { value, configurable: true })

  it('calls persist() exactly once per page load', () => {
    const persist = vi.fn().mockResolvedValue(true)
    stubStorage({ persist })
    requestPersistenceOnce()
    requestPersistenceOnce()
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when unsupported', () => {
    stubStorage(undefined)
    expect(() => requestPersistenceOnce()).not.toThrow()
    resetPersistenceRequestForTests()
    stubStorage({})
    expect(() => requestPersistenceOnce()).not.toThrow()
  })

  it('swallows rejections and synchronous throws', async () => {
    stubStorage({ persist: () => Promise.reject(new Error('denied')) })
    expect(() => requestPersistenceOnce()).not.toThrow()
    await Promise.resolve()
    resetPersistenceRequestForTests()
    stubStorage({
      persist: () => {
        throw new Error('sync')
      },
    })
    expect(() => requestPersistenceOnce()).not.toThrow()
  })
})
