import { type RefObject, useEffect, useRef } from 'react'

/**
 * Where focus should land after a client-side navigation: the page's first
 * `h1` inside `main` (made programmatically focusable), else `main` itself.
 * Returns the focused element, or `null` when focus was left alone because it
 * is already somewhere inside `main` (an autofocused input, say) or on a
 * control the user is operating outside it.
 */
export const focusPageHeading = (main: HTMLElement | null, active: Element | null): HTMLElement | null => {
  if (main === null) return null
  if (active !== null && active !== document.body && main.contains(active)) return null
  const target = main.querySelector<HTMLElement>('h1') ?? main
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  target.focus({ preventScroll: false })
  return target
}

/**
 * Moves focus to the page heading whenever `pathname` changes (not on first
 * mount), so keyboard and screen-reader users land at the top of the new page
 * instead of on `body` after the focused link/button unmounts.
 */
export const useRouteFocus = (pathname: string, mainRef: RefObject<HTMLElement | null>): void => {
  const previous = useRef(pathname)
  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    focusPageHeading(mainRef.current, document.activeElement)
  }, [pathname, mainRef])
}

/** Focuses `ref` once when `enabled` becomes true (used for in-page "session complete" panels). */
export const useFocusWhen = (ref: RefObject<HTMLElement | null>, enabled: boolean): void => {
  useEffect(() => {
    if (!enabled) return
    ref.current?.focus()
  }, [ref, enabled])
}
