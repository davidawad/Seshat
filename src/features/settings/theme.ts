/**
 * Applies the user's theme/typeface/motion/sizing settings to the
 * document, and resolves them into a live preview so the Settings page
 * can render the typeface picker without duplicating this logic.
 *
 * The pure resolution + DOM application live in theme-boot.ts, shared with
 * the blocking pre-paint boot script (vite-plugins/theme-boot.ts) so the
 * first paint and every later update decide identically; they are
 * re-exported here so existing importers keep working.
 */
import { useEffect, useState } from 'react'
import { useSeshatStore } from '../../lib/store'
import type { ColorMode } from './palettes'
import { applyThemeDom, resolveEffectiveMode, resolveThemeDom } from './theme-boot'

export {
  resolveEffectiveMode,
  resolveSizingCssVars,
  resolveThemeAttribute,
  resolveTypefaceAttribute,
  type SizingCssVars,
} from './theme-boot'

// ---------------------------------------------------------------------------
// Live OS preference + DOM application — imperative, isolated to this one
// effect so every other component can stay declarative and just read
// `useSeshatStore().state`.
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
    applyThemeDom(document, resolveThemeDom(settings, mode))
  }, [settings, mode])
}
