/**
 * Applies the user's theme/typeface/motion/sizing settings to the
 * document, and resolves them into a live preview so the Settings page
 * can render the typeface picker without duplicating this logic.
 */
import { useEffect } from 'react'
import { useSeshatStore } from '../../lib/store'
import type { Settings, Theme, Typeface } from '../../types'

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

export const useApplyTheme = (): void => {
  const { state } = useSeshatStore()
  const { settings } = state

  useEffect(() => {
    const root = document.documentElement

    root.dataset['typeface'] = resolveTypefaceAttribute(settings.typeface)

    const themeAttribute = resolveThemeAttribute(settings.theme)
    if (themeAttribute === null) {
      delete root.dataset['theme']
    } else {
      root.dataset['theme'] = themeAttribute
    }

    root.dataset['reducedMotion'] = settings.reducedMotion ? 'true' : 'false'

    const sizingVars = resolveSizingCssVars(settings)
    for (const [property, value] of Object.entries(sizingVars)) {
      root.style.setProperty(property, value)
    }
  }, [settings])
}
