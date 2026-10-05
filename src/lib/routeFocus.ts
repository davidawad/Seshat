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

/** What `useRouteFocus` needs to know about the current navigation (from react-router's hooks). */
export interface RouteFocusTarget {
  readonly pathname: string
  /** `useLocation().key`: unique per history entry, so Back/Forward and redirects are distinguishable. */
  readonly key?: string
  /** `useNavigationType()`: `POP` is browser Back/Forward, `REPLACE` is a redirect. */
  readonly type?: 'POP' | 'PUSH' | 'REPLACE'
}

const isTextEntry = (element: Element | null): boolean =>
  element instanceof HTMLInputElement ||
  element instanceof HTMLTextAreaElement ||
  element instanceof HTMLSelectElement ||
  (element instanceof HTMLElement && element.isContentEditable)

/** True when focus is nowhere useful: on body, on `main` itself, or on an element that left the DOM. */
const focusIsLost = (main: HTMLElement, active: Element | null): boolean =>
  active === null || active === document.body || active === main || !active.isConnected

/** How long after a navigation a late-mounting (lazy / redirected) heading may still claim focus. */
const SETTLE_MS = 3_000

/**
 * Moves focus to the page heading after every navigation to a different page (not on first
 * mount), so keyboard and screen-reader users land at the top of the new page instead of on
 * `body` after the focused link/button unmounts. Covers browser Back/Forward (`POP`) and
 * redirects (`REPLACE`) as well as links: it keys off the location entry, not the pathname
 * alone, and keeps watching briefly because lazy routes and redirected pages mount (or swap)
 * their `h1` after the first effect. It never steals focus from a field the user is typing in
 * or from a control inside the page.
 */
export const useRouteFocus = (route: RouteFocusTarget, mainRef: RefObject<HTMLElement | null>): void => {
  const { pathname, type } = route
  const key = route.key ?? pathname
  const previous = useRef({ key, pathname })
  useEffect(() => {
    const last = previous.current
    previous.current = { key, pathname }
    if (last.key === key) return undefined
    // A same-page search/hash change (a filter, an anchor) is not a page change.
    if (last.pathname === pathname && type !== 'POP') return undefined
    const main = mainRef.current
    if (main === null) return undefined
    if (!isTextEntry(document.activeElement)) focusPageHeading(main, document.activeElement)
    const reclaim = () => {
      const active = document.activeElement
      if (isTextEntry(active) || !focusIsLost(main, active)) return
      const heading = main.querySelector<HTMLElement>('h1')
      if (heading === null) return
      heading.setAttribute('tabindex', '-1')
      heading.focus()
    }
    const observer = new MutationObserver(reclaim)
    observer.observe(main, { childList: true, subtree: true })
    // The first focus can also land on something that unmounts right after (a redirect).
    const retry = window.setTimeout(reclaim, 150)
    const stop = window.setTimeout(() => observer.disconnect(), SETTLE_MS)
    return () => {
      observer.disconnect()
      window.clearTimeout(retry)
      window.clearTimeout(stop)
    }
  }, [key, pathname, type, mainRef])
}

/** Focuses `ref` once when `enabled` becomes true (used for in-page "session complete" panels). */
export const useFocusWhen = (ref: RefObject<HTMLElement | null>, enabled: boolean): void => {
  useEffect(() => {
    if (!enabled) return
    ref.current?.focus()
  }, [ref, enabled])
}
