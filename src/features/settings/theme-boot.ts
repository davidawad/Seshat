/**
 * The pure, DOM-light core of theming, shared by the React runtime
 * (`useApplyTheme` in theme.ts) and the blocking boot script that
 * vite-plugins/theme-boot.ts bundles into index.html. Everything the boot
 * script needs lives here, so both paths decide identically:
 * `resolveThemeDom` (what to set) and `applyThemeDom` (how to set it).
 *
 * Constraint: this module's import graph must stay tiny (palettes +
 * contrast only — NO zod, NO react), because it is inlined into every HTML
 * response. The settings validation below is therefore a hand-written
 * mirror of `settingsSchema` limited to the appearance fields;
 * theme-boot.test.ts pins it to the schema (ranges, defaults, enums).
 */
import type { Settings, Theme, Typeface } from '../../types'
import { PALETTES, PALETTE_VARIABLES, resolvePaletteCssVars, type ColorMode } from './palettes'

/** The subset of `Settings` that drives appearance. */
export type ThemeSettings = Pick<
  Settings,
  'typeface' | 'theme' | 'palette' | 'customAccent' | 'reducedMotion' | 'bodyFontSizePt' | 'lineHeight' | 'measureCh'
>

// ---------------------------------------------------------------------------
// Pure resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a `Settings['theme']` into the `data-theme` attribute value that
 * should be set on `<html>`. `'system'` means "don't force it" — the
 * `prefers-color-scheme` media query in tokens.css decides — so it resolves
 * to `null`, which callers should treat as "remove the attribute."
 */
export const resolveThemeAttribute = (theme: Theme): 'light' | 'dark' | null => (theme === 'system' ? null : theme)

/**
 * The mode actually on screen: an explicit light/dark wins; `'system'`
 * follows the OS. Mirrors tokens.css, where light applies only when the OS
 * prefers light and everything else is the dark default.
 */
export const resolveEffectiveMode = (theme: Theme, systemPrefersLight: boolean): ColorMode =>
  theme === 'system' ? (systemPrefersLight ? 'light' : 'dark') : theme

/** Maps a `Settings['typeface']` to the `data-typeface` attribute value. */
export const resolveTypefaceAttribute = (typeface: Typeface): Typeface => typeface

/** CSS custom-property values derived from the sizing fields of `Settings`. */
export interface SizingCssVars {
  readonly '--font-size-body': string
  readonly '--line-height-body': string
  readonly '--measure': string
}

export const resolveSizingCssVars = (
  settings: Pick<Settings, 'bodyFontSizePt' | 'lineHeight' | 'measureCh'>,
): SizingCssVars => ({
  '--font-size-body': `${settings.bodyFontSizePt}pt`,
  '--line-height-body': `${settings.lineHeight}`,
  '--measure': `${settings.measureCh}ch`,
})

/** Everything to put on <html> (and in <meta name="theme-color">) for one settings + mode pair. */
export interface ThemeDom {
  readonly dataset: {
    readonly typeface: Typeface
    /** `null` = remove the attribute (theme 'system'). */
    readonly theme: 'light' | 'dark' | null
    readonly palette: Settings['palette']
    readonly reducedMotion: 'true' | 'false'
  }
  /** Inline custom properties: palette (+ custom accent) and sizing. */
  readonly vars: Readonly<Record<string, string>>
  /** The resolved background — also the browser chrome color. */
  readonly themeColor: string
}

export const resolveThemeDom = (settings: ThemeSettings, mode: ColorMode): ThemeDom => ({
  dataset: {
    typeface: resolveTypefaceAttribute(settings.typeface),
    theme: resolveThemeAttribute(settings.theme),
    palette: settings.palette,
    reducedMotion: settings.reducedMotion ? 'true' : 'false',
  },
  vars: {
    ...resolvePaletteCssVars(settings.palette, mode, settings.customAccent),
    ...resolveSizingCssVars(settings),
  },
  themeColor: PALETTES[settings.palette][mode]['--color-bg'],
})

// ---------------------------------------------------------------------------
// DOM application
// ---------------------------------------------------------------------------

/** Sets (creating if absent) the single `<meta name="theme-color">`. */
const setThemeColorMeta = (doc: Document, color: string): void => {
  let meta = doc.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta === null) {
    meta = doc.createElement('meta')
    meta.name = 'theme-color'
    doc.head.append(meta)
  }
  meta.content = color
}

/** Idempotent: clears stale palette variables first, so re-applying never accumulates. */
export const applyThemeDom = (doc: Document, dom: ThemeDom): void => {
  const root = doc.documentElement
  root.dataset['typeface'] = dom.dataset.typeface
  if (dom.dataset.theme === null) {
    delete root.dataset['theme']
  } else {
    root.dataset['theme'] = dom.dataset.theme
  }
  root.dataset['palette'] = dom.dataset.palette
  root.dataset['reducedMotion'] = dom.dataset.reducedMotion
  // Inline variables on <html> outrank every stylesheet rule (including the
  // [data-theme] and prefers-color-scheme blocks in tokens.css).
  for (const variable of PALETTE_VARIABLES) root.style.removeProperty(variable)
  for (const [variable, value] of Object.entries(dom.vars)) root.style.setProperty(variable, value)
  setThemeColorMeta(doc, dom.themeColor)
}

// ---------------------------------------------------------------------------
// Boot: read persisted settings defensively (mirrors storage.ts's order)
// ---------------------------------------------------------------------------

// Same keys, same order as src/lib/storage.ts (kept literal: this module is bundled into a tiny pre-paint script).
const STATE_KEYS = ['seshat:app-state:v2', 'seshat:app-state:v1'] as const
const SETTINGS_COOKIE_NAME = 'seshat_settings'

/** Defaults for the appearance fields; pinned to DEFAULT_SETTINGS by test. */
export const BOOT_DEFAULTS: ThemeSettings = {
  typeface: 'atkinson-hyperlegible',
  bodyFontSizePt: 12.5,
  lineHeight: 1.45,
  measureCh: 65,
  theme: 'system',
  palette: 'archive',
  customAccent: null,
  reducedMotion: false,
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const inRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && value >= min && value <= max

/** Ranges mirror settingsSchema (pinned by test). */
const FIELD_CHECKS: { readonly [K in keyof ThemeSettings]: (value: unknown) => value is ThemeSettings[K] } = {
  // Open set on purpose (the enum lives in zod); unknown names match no CSS rule.
  typeface: (v): v is Typeface => typeof v === 'string' && /^[a-z0-9-]{1,40}$/.test(v),
  bodyFontSizePt: (v): v is number => inRange(v, 11.5, 13),
  lineHeight: (v): v is number => inRange(v, 1.4, 1.5),
  measureCh: (v): v is number => inRange(v, 55, 75),
  theme: (v): v is Theme => v === 'light' || v === 'dark' || v === 'system',
  palette: (v): v is Settings['palette'] => typeof v === 'string' && Object.hasOwn(PALETTES, v),
  customAccent: (v): v is string | null => v === null || (typeof v === 'string' && /^#[0-9a-f]{6}$/.test(v)),
  reducedMotion: (v): v is boolean => typeof v === 'boolean',
}

/** Fields settingsSchema has no default for: required in the localStorage copy. */
const REQUIRED_FIELDS = ['typeface', 'bodyFontSizePt', 'lineHeight', 'measureCh', 'theme', 'reducedMotion'] as const

/**
 * Valid appearance settings from an untrusted object, or null. `strict`
 * (the localStorage copy, a full Settings) requires the schema-required
 * fields; otherwise (the cookie mirror, a partial) absent fields take
 * defaults. Any present-but-invalid field rejects the whole object, like
 * the schema does.
 */
export const coerceThemeSettings = (raw: unknown, strict: boolean): ThemeSettings | null => {
  if (!isRecord(raw)) return null
  if (strict && REQUIRED_FIELDS.some((key) => raw[key] === undefined)) return null
  const out: Record<string, unknown> = { ...BOOT_DEFAULTS }
  for (const key of Object.keys(FIELD_CHECKS) as (keyof ThemeSettings)[]) {
    const value = raw[key]
    if (value === undefined) continue
    if (!FIELD_CHECKS[key](value)) return null
    out[key] = value
  }
  return out as unknown as ThemeSettings
}

const parseJson = (text: string | null): unknown => {
  if (text === null) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

const cookieValue = (header: string, name: string): string | null => {
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith(`${name}=`)) return trimmed.slice(name.length + 1)
  }
  return null
}

/** Raw sources, injected so tests need no browser globals. Each may throw. */
export interface BootSources {
  readonly localState: (key: string) => string | null
  readonly cookies: () => string
}

/** localStorage app state (v2, else the not-yet-migrated v1), else the cookie mirror, else defaults. Never throws. */
export const readBootSettings = (sources: BootSources): ThemeSettings => {
  for (const key of STATE_KEYS) {
    try {
      const state = parseJson(sources.localState(key))
      const fromLocal = isRecord(state) ? coerceThemeSettings(state['settings'], true) : null
      if (fromLocal !== null) return fromLocal
    } catch {
      // storage blocked — try the next key, then the mirror.
    }
  }
  try {
    const encoded = cookieValue(sources.cookies(), SETTINGS_COOKIE_NAME)
    const fromCookie = encoded === null ? null : coerceThemeSettings(parseJson(decodeURIComponent(encoded)), false)
    if (fromCookie !== null) return fromCookie
  } catch {
    // malformed cookie escape sequence.
  }
  return BOOT_DEFAULTS
}

/** The boot script's entry point: resolve and apply before first paint. Never throws. */
export const bootTheme = (win: Window): void => {
  try {
    const settings = readBootSettings({
      localState: (key) => win.localStorage.getItem(key),
      cookies: () => win.document.cookie,
    })
    const prefersLight = typeof win.matchMedia === 'function' && win.matchMedia('(prefers-color-scheme: light)').matches
    applyThemeDom(win.document, resolveThemeDom(settings, resolveEffectiveMode(settings.theme, prefersLight)))
  } catch {
    // Theming must never block the app from loading.
  }
}
