import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, settingsSchema, typefaceSchema } from '../../types'
import { PALETTES } from './palettes'
import {
  BOOT_DEFAULTS,
  applyThemeDom,
  bootTheme,
  coerceThemeSettings,
  readBootSettings,
  resolveThemeDom,
} from './theme-boot'

describe('boot validation is pinned to settingsSchema', () => {
  it('defaults match DEFAULT_SETTINGS', () => {
    for (const [key, value] of Object.entries(BOOT_DEFAULTS)) {
      expect(DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS]).toEqual(value)
    }
  })

  it('accepts exactly the schema ranges for sizing', () => {
    for (const key of ['bodyFontSizePt', 'lineHeight', 'measureCh'] as const) {
      const { minValue, maxValue } = settingsSchema.shape[key]
      expect(minValue).not.toBeNull()
      expect(maxValue).not.toBeNull()
      for (const ok of [minValue, maxValue]) expect(coerceThemeSettings({ [key]: ok }, false)).not.toBeNull()
      for (const bad of [(minValue ?? 0) - 0.01, (maxValue ?? 0) + 0.01]) {
        expect(coerceThemeSettings({ [key]: bad }, false)).toBeNull()
      }
    }
  })

  it('accepts every schema typeface and palette', () => {
    for (const typeface of typefaceSchema.options) expect(coerceThemeSettings({ typeface }, false)).not.toBeNull()
    for (const palette of Object.keys(PALETTES)) expect(coerceThemeSettings({ palette }, false)).not.toBeNull()
  })

  it('rejects bad values and non-objects', () => {
    const bad = [null, 3, [], 'x', { theme: 'blue' }, { customAccent: 'red' }, { reducedMotion: 1 }, { typeface: 3 }]
    for (const raw of bad) expect(coerceThemeSettings(raw, false)).toBeNull()
  })

  it('strict mode requires the schema-required fields; partial mode fills defaults', () => {
    expect(coerceThemeSettings({ palette: 'rose' }, true)).toBeNull()
    expect(coerceThemeSettings({ palette: 'rose' }, false)).toEqual({ ...BOOT_DEFAULTS, palette: 'rose' })
    expect(coerceThemeSettings(DEFAULT_SETTINGS, true)).toEqual(BOOT_DEFAULTS)
  })
})

describe('readBootSettings', () => {
  const never = (): never => {
    throw new Error('blocked')
  }

  it('prefers the local state, then the cookie, then defaults', () => {
    const local = JSON.stringify({ settings: { ...DEFAULT_SETTINGS, theme: 'dark' } })
    const cookie = `a=1; seshat_settings=${encodeURIComponent(JSON.stringify({ theme: 'light' }))}`
    expect(readBootSettings({ localState: () => local, cookies: () => cookie }).theme).toBe('dark')
    expect(readBootSettings({ localState: () => null, cookies: () => cookie }).theme).toBe('light')
    expect(readBootSettings({ localState: () => null, cookies: () => '' })).toEqual(BOOT_DEFAULTS)
  })

  it('never throws', () => {
    expect(readBootSettings({ localState: never, cookies: never })).toEqual(BOOT_DEFAULTS)
    const badCookie = 'seshat_settings=%E0%A4%A'
    expect(readBootSettings({ localState: () => null, cookies: () => badCookie })).toEqual(BOOT_DEFAULTS)
  })
})

describe('applyThemeDom / bootTheme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style')
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove())
  })

  it('creates the meta once, then updates it, and clears stale vars', () => {
    applyThemeDom(document, resolveThemeDom({ ...DEFAULT_SETTINGS, palette: 'rose' }, 'dark'))
    applyThemeDom(document, resolveThemeDom({ ...DEFAULT_SETTINGS, palette: 'archive' }, 'light'))
    const metas = document.head.querySelectorAll('meta[name="theme-color"]')
    expect(metas).toHaveLength(1)
    expect(metas[0]?.getAttribute('content')).toBe(PALETTES.archive.light['--color-bg'])
    expect(document.documentElement.style.getPropertyValue('--color-bg')).toBe('')
    expect(document.documentElement.dataset['theme']).toBeUndefined()
  })

  it('bootTheme swallows a hostile window', () => {
    expect(() => bootTheme({} as Window)).not.toThrow()
  })
})
