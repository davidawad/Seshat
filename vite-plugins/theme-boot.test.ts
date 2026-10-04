// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PALETTES, type ColorMode } from '../src/features/settings/palettes.ts'
import { applyThemeDom, resolveEffectiveMode, resolveThemeDom } from '../src/features/settings/theme-boot.ts'
import { DEFAULT_SETTINGS, type Settings } from '../src/types.ts'
import { BOOT_MARKER, buildBootScript, injectBootScript } from './theme-boot.ts'

let script = ''
beforeAll(async () => {
  script = await buildBootScript()
}, 60_000)

const STATE_KEY = 'seshat:app-state:v2'
const LEGACY_STATE_KEY = 'seshat:app-state:v1'

const setSystemLight = (light: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: light && query.includes('light') })) as typeof window.matchMedia
}

const reset = () => {
  document.documentElement.removeAttribute('style')
  for (const attr of [...document.documentElement.attributes]) {
    if (attr.name.startsWith('data-')) document.documentElement.removeAttribute(attr.name)
  }
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove())
  window.localStorage.clear()
  document.cookie = 'seshat_settings=; Max-Age=0; Path=/'
  setSystemLight(false)
}

/** Everything the boot/runtime writes, as comparable plain data. */
const snapshot = () => ({
  attrs: Object.fromEntries(
    [...document.documentElement.attributes].filter((a) => a.name.startsWith('data-')).map((a) => [a.name, a.value]),
  ),
  style: document.documentElement.getAttribute('style'),
  metas: [...document.head.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute('content')),
})

const runBootScript = () => window.eval(script)

beforeEach(reset)

describe('boot script vs useApplyTheme resolution', () => {
  const modes: ColorMode[] = ['light', 'dark']
  // none; passes 3:1 on light backgrounds only; passes 3:1 on dark backgrounds only
  const accents = [null, '#1166cc', '#ee9944']
  for (const palette of Object.keys(PALETTES) as Settings['palette'][]) {
    for (const mode of modes) {
      for (const customAccent of accents) {
        for (const theme of ['explicit', 'system'] as const) {
          it(`${palette} / ${mode} / ${theme} / accent ${customAccent ?? 'none'}`, () => {
            const settings: Settings = {
              ...DEFAULT_SETTINGS,
              palette,
              customAccent,
              theme: theme === 'explicit' ? mode : 'system',
              reducedMotion: true,
              typeface: 'georgia',
              bodyFontSizePt: 13,
              lineHeight: 1.4,
              measureCh: 55,
            }

            // Runtime path: exactly what useApplyTheme's effect does.
            applyThemeDom(document, resolveThemeDom(settings, resolveEffectiveMode(settings.theme, mode === 'light')))
            const runtime = snapshot()
            reset()

            // Boot path: the generated script reading persisted state.
            setSystemLight(mode === 'light')
            window.localStorage.setItem(STATE_KEY, JSON.stringify({ version: 2, sets: [], cards: [], settings }))
            runBootScript()
            expect(snapshot()).toEqual(runtime)
            expect(runtime.metas).toEqual([PALETTES[palette][mode]['--color-bg']])
          })
        }
      }
    }
  }
})

describe('boot script persistence handling', () => {
  const rose: Settings = { ...DEFAULT_SETTINGS, palette: 'rose', theme: 'light' }

  it('falls back to the cookie mirror when localStorage is empty', () => {
    const value = encodeURIComponent(JSON.stringify({ palette: 'rose', theme: 'light' }))
    document.cookie = `seshat_settings=${value}; Path=/`
    runBootScript()
    expect(document.documentElement.dataset['palette']).toBe('rose')
    expect(document.documentElement.dataset['theme']).toBe('light')
    expect(snapshot().metas).toEqual([PALETTES.rose.light['--color-bg']])
  })

  it('prefers localStorage over the cookie', () => {
    document.cookie = `seshat_settings=${encodeURIComponent(JSON.stringify({ palette: 'slate' }))}; Path=/`
    window.localStorage.setItem(STATE_KEY, JSON.stringify({ version: 2, settings: rose }))
    runBootScript()
    expect(document.documentElement.dataset['palette']).toBe('rose')
  })

  it('reads the not-yet-migrated v1 key when v2 is absent, and prefers v2 when both exist', () => {
    window.localStorage.setItem(LEGACY_STATE_KEY, JSON.stringify({ version: 1, settings: rose }))
    runBootScript()
    expect(document.documentElement.dataset['palette']).toBe('rose')
    reset()
    const slate: Settings = { ...DEFAULT_SETTINGS, palette: 'slate' }
    window.localStorage.setItem(STATE_KEY, JSON.stringify({ version: 2, settings: slate }))
    runBootScript()
    expect(document.documentElement.dataset['palette']).toBe('slate')
  })

  it('falls through a corrupt v2 to a valid v1, then to the cookie', () => {
    window.localStorage.setItem(STATE_KEY, '{not json')
    window.localStorage.setItem(LEGACY_STATE_KEY, JSON.stringify({ version: 1, settings: rose }))
    runBootScript()
    expect(document.documentElement.dataset['palette']).toBe('rose')
  })

  it.each([
    ['invalid JSON', '{not json'],
    ['a non-object', '42'],
    ['null', 'null'],
    ['missing settings', '{"version":1}'],
    ['invalid field values', JSON.stringify({ settings: { ...rose, palette: 'neon' } })],
  ])('does not throw on corrupt storage (%s) and uses defaults', (_name, raw) => {
    window.localStorage.setItem(STATE_KEY, raw)
    expect(() => runBootScript()).not.toThrow()
    expect(document.documentElement.dataset['palette']).toBe('archive')
    expect(document.documentElement.dataset['theme']).toBeUndefined()
  })

  it('survives a malformed cookie and throwing storage', () => {
    document.cookie = 'seshat_settings=%E0%A4%A; Path=/'
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked')
      },
    })
    try {
      expect(() => runBootScript()).not.toThrow()
    } finally {
      if (original !== undefined) Object.defineProperty(window, 'localStorage', original)
    }
    expect(document.documentElement.dataset['palette']).toBe('archive')
  })

  it('updates an existing theme-color meta instead of adding a second', () => {
    document.head.insertAdjacentHTML('beforeend', '<meta name="theme-color" content="#5B3DF5">')
    window.localStorage.setItem(STATE_KEY, JSON.stringify({ version: 2, settings: rose }))
    runBootScript()
    expect(snapshot().metas).toEqual([PALETTES.rose.light['--color-bg']])
  })
})

describe('injectBootScript', () => {
  const page = `<html><head><meta charset="utf-8">\n    ${BOOT_MARKER}\n<link rel="stylesheet" href="x.css"></head><body></body></html>`

  it('inlines the script at the marker, before stylesheets, with a fallback meta', () => {
    const out = injectBootScript(page, script)
    expect(out).not.toContain(BOOT_MARKER)
    expect(out).toContain('<script data-seshat-boot>')
    expect(out.indexOf('data-seshat-boot')).toBeLessThan(out.indexOf('<link'))
    expect(out).toContain('<meta name="theme-color" content="#1b1712" />')
  })

  it('falls back to the end of <head> when the marker is missing', () => {
    const out = injectBootScript('<html><head></head><body></body></html>', script)
    expect(out.indexOf('data-seshat-boot')).toBeLessThan(out.indexOf('</head>'))
  })

  it('is idempotent', () => {
    const once = injectBootScript(page, script)
    expect(injectBootScript(once, script)).toBe(once)
  })

  it('never emits a literal closing script tag inside the script, and stays small', () => {
    expect(script).not.toContain('</script')
    expect(script.length).toBeLessThan(12_000)
  })
})
