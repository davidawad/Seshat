/**
 * Applies the user's theme/typeface/motion/sizing settings to the
 * document, and resolves them into a live preview so the Settings page
 * can render the typeface picker without duplicating this logic.
 */
import { useEffect, useState } from 'react'
import { useSeshatStore } from '../../lib/store'
import type { Settings, Theme, Typeface } from '../../types'
import { PALETTE_VARIABLES, resolvePaletteCssVars, type ColorMode } from './palettes'

// ---------------------------------------------------------------------------
// Pure logic (no DOM, no React) — easy to unit test in isolation.
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

// ---------------------------------------------------------------------------
// DOM application — imperative, isolated to this one effect so every other
// component can stay declarative and just read `useSeshatStore().state`.
// ---------------------------------------------------------------------------

const LIGHT_QUERY = '(prefers-color-scheme: light)'

const readSystemPrefersLight = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(LIGHT_QUERY).matches

/** Live OS light/dark preference — re-renders when the OS flips it. */
const useSystemPrefersLight = (): boolean => {
  const [prefersLight, setPrefersLight] = useState(readSystemPrefersLight)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const query = window.matchMedia(LIGHT_QUERY)
    const onChange = (event: MediaQueryListEvent) => setPrefersLight(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return prefersLight
}

/** The light/dark mode currently on screen, given the user's theme setting and the OS. */
export const useEffectiveMode = (): ColorMode => {
  const { state } = useSeshatStore()
  return resolveEffectiveMode(state.settings.theme, useSystemPrefersLight())
}

export const useApplyTheme = (): void => {
  const { state } = useSeshatStore()
  const { settings } = state
  const mode = resolveEffectiveMode(settings.theme, useSystemPrefersLight())

  useEffect(() => {
    const root = document.documentElement

    root.dataset['typeface'] = resolveTypefaceAttribute(settings.typeface)

    const themeAttribute = resolveThemeAttribute(settings.theme)
    if (themeAttribute === null) {
      delete root.dataset['theme']
    } else {
      root.dataset['theme'] = themeAttribute
    }

    // Palette: inline variables on <html> outrank every stylesheet rule
    // (including the [data-theme] and prefers-color-scheme blocks in
    // tokens.css), so they win for all theme/palette combinations; the
    // effective mode picks which half of the palette to inline.
    root.dataset['palette'] = settings.palette
    for (const variable of PALETTE_VARIABLES) root.style.removeProperty(variable)
    for (const [variable, value] of Object.entries(
      resolvePaletteCssVars(settings.palette, mode, settings.customAccent),
    )) {
      root.style.setProperty(variable, value)
    }

    root.dataset['reducedMotion'] = settings.reducedMotion ? 'true' : 'false'

    const sizingVars = resolveSizingCssVars(settings)
    for (const [property, value] of Object.entries(sizingVars)) {
      root.style.setProperty(property, value)
    }
  }, [settings, mode])
}
