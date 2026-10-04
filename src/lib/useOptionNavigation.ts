import { type RefObject, useEffect } from 'react'
import { matchesBinding } from './keybindings'
import { useKeybindings } from './useKeybindings'

export type NavDirection = 'up' | 'down' | 'left' | 'right'
export type NavOrientation = 'vertical' | 'horizontal' | 'grid'

/** Attribute a component puts on each navigable option so the hook can move real DOM focus to it. */
export const NAV_OPTION_ATTRIBUTE = 'data-nav-option'

export interface MoveIndexInput {
  readonly count: number
  /** The currently highlighted index, or `null` when nothing is highlighted yet. */
  readonly index: number | null
  readonly direction: NavDirection
  readonly orientation: NavOrientation
  /** Items per row for `'grid'`; ignored otherwise. Values below 1 are treated as 1. */
  readonly columns?: number | undefined
  /** Indices that cannot be highlighted (matched tiles, full columns, unavailable games) are skipped. */
  readonly isDisabled?: ((index: number) => boolean) | undefined
}

const wrap = (value: number, count: number): number => ((value % count) + count) % count

/** Last index in the same column as `index` (a ragged final row may not reach every column). */
const lastInColumn = (index: number, count: number, columns: number): number => {
  const column = index % columns
  return column + Math.floor((count - 1 - column) / columns) * columns
}

/** Does `direction` mean anything for this orientation? */
const appliesTo = (direction: NavDirection, orientation: NavOrientation): boolean =>
  orientation === 'grid' ||
  (orientation === 'vertical'
    ? direction === 'up' || direction === 'down'
    : direction === 'left' || direction === 'right')

interface Layout {
  readonly count: number
  readonly orientation: NavOrientation
  readonly columns: number
}

/** One wrapping step from `from` (caller has already checked `appliesTo`). */
const step = (from: number, direction: NavDirection, { count, orientation, columns }: Layout): number => {
  if (orientation !== 'grid' || direction === 'left' || direction === 'right')
    return wrap(from + (direction === 'up' || direction === 'left' ? -1 : 1), count)
  if (direction === 'down') return from + columns >= count ? from % columns : from + columns
  return from - columns < 0 ? lastInColumn(from, count, columns) : from - columns
}

/** First candidate: one step from a valid highlight, else the first item (next-style keys) or last (previous-style). */
const firstCandidate = (index: number | null, direction: NavDirection, layout: Layout): number => {
  if (index !== null && index >= 0 && index < layout.count) return step(index, direction, layout)
  return direction === 'down' || direction === 'right' ? 0 : layout.count - 1
}

/**
 * Pure movement logic: where does the highlight go when `direction` is pressed?
 *
 * Policy is WRAP, never clamp: stepping past either end continues from the
 * opposite end, so a held key keeps cycling. In a grid, left/right step through
 * the list in reading order (wrapping), while up/down move by `columns` and wrap
 * to the other end of the SAME column (a ragged last row is handled by landing
 * on the column's last existing cell). With nothing highlighted yet,
 * next-style keys (down/right) land on the first item and previous-style keys
 * (up/left) on the last. Disabled indices are skipped in the direction of travel.
 *
 * Returns `null` ("not handled") when there is nothing to move to, when the
 * direction does not apply to the orientation (left/right in a vertical list),
 * or when every candidate is disabled — callers then must not preventDefault.
 */
export const moveIndex = ({
  count,
  index,
  direction,
  orientation,
  columns = 1,
  isDisabled = () => false,
}: MoveIndexInput): number | null => {
  if (count <= 0 || !appliesTo(direction, orientation)) return null
  const layout: Layout = { count, orientation, columns: Math.max(1, Math.floor(columns)) }
  let candidate = firstCandidate(index, direction, layout)
  for (let tries = 0; tries < count; tries++) {
    if (!isDisabled(candidate)) return candidate
    candidate = step(candidate, direction, layout)
  }
  return null
}

/** Number of grid tracks currently laid out for `container` (CSS grid), or 1 if it is not a grid. */
export const measureColumns = (container: HTMLElement | null): number => {
  if (container === null) return 1
  const tracks = getComputedStyle(container)
    .gridTemplateColumns.split(' ')
    .filter((track) => track !== '' && track !== '0px')
  return tracks.length > 0 && tracks[0] !== 'none' ? tracks.length : 1
}

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable)

/** Buttons/links/radios already activate themselves on Enter/Space — the hook must not double-fire. */
const isSelfActivating = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target instanceof HTMLButtonElement ||
    target instanceof HTMLAnchorElement ||
    target.getAttribute('role') === 'button' ||
    target.getAttribute('role') === 'radio')

export interface UseOptionNavigationOptions {
  readonly count: number
  readonly index: number | null
  readonly onIndexChange: (index: number) => void
  /** Commit the highlighted option on Enter/Space — only fires when focus is NOT already on a self-activating element. */
  readonly onConfirm?: ((index: number) => void) | undefined
  readonly orientation: NavOrientation
  /** Items per row for `'grid'`; measured from `containerRef`'s CSS grid when omitted. */
  readonly columns?: number | undefined
  readonly enabled: boolean
  /** Contains the options (each marked with `NAV_OPTION_ATTRIBUTE`); real DOM focus is moved onto the highlighted one. */
  readonly containerRef?: RefObject<HTMLElement | null> | undefined
  readonly isDisabled?: ((index: number) => boolean) | undefined
}

const DIRECTION_ACTIONS: readonly (readonly [NavDirection, string])[] = [
  ['up', 'nav.up'],
  ['down', 'nav.down'],
  ['left', 'nav.left'],
  ['right', 'nav.right'],
]

const directionOf = (event: KeyboardEvent, keyFor: (actionId: string) => string): NavDirection | undefined =>
  DIRECTION_ACTIONS.find(([, actionId]) => matchesBinding(keyFor(actionId), event))?.[0]

/** Moves the highlight (and real focus) for `direction`; returns whether the key was handled. */
const handleMove = (event: KeyboardEvent, direction: NavDirection, options: UseOptionNavigationOptions): void => {
  const { count, index, orientation, columns, containerRef, isDisabled, onIndexChange } = options
  const next = moveIndex({
    count,
    index,
    direction,
    orientation,
    columns: columns ?? (orientation === 'grid' ? measureColumns(containerRef?.current ?? null) : 1),
    isDisabled,
  })
  if (next === null) return
  event.preventDefault()
  onIndexChange(next)
  containerRef?.current?.querySelectorAll<HTMLElement>(`[${NAV_OPTION_ATTRIBUTE}]`)[next]?.focus()
}

/** A plain Enter/Space press (no Shift, not an auto-repeat) that no focused control would activate by itself. */
const isCommitPress = (event: KeyboardEvent): boolean =>
  (event.key === 'Enter' || event.key === ' ') && !event.shiftKey && !event.repeat && !isSelfActivating(event.target)

/** The index Enter/Space would commit, or `null` when the key is not a commit press or the highlight cannot be committed. */
const confirmableIndex = (
  event: KeyboardEvent,
  { count, index, isDisabled }: UseOptionNavigationOptions,
): number | null => {
  if (index === null || index < 0 || index >= count || !isCommitPress(event)) return null
  return isDisabled?.(index) === true ? null : index
}

/** Enter/Space commits the highlight when nothing focused would activate itself. */
const handleConfirm = (event: KeyboardEvent, options: UseOptionNavigationOptions): void => {
  const index = confirmableIndex(event, options)
  if (index === null || options.onConfirm === undefined) return
  event.preventDefault()
  options.onConfirm(index)
}

/**
 * Arrow-style navigation (the remappable `nav.*` actions — arrows, WASD, HJKL
 * or custom) over a set of options that also have digit-key shortcuts. Drives
 * a controlled highlight index and moves real DOM focus to that option so
 * screen readers announce it. Listens on window keydown like
 * `useNumberedShortcut`; ignores text fields and modifier combos; calls
 * preventDefault only for keys it handled so page scrolling still works when
 * nothing is selectable. Held keys auto-repeat movement (cycling); confirm
 * ignores repeats. See `moveIndex` for the wrap policy.
 */
const createKeydownHandler =
  (options: UseOptionNavigationOptions, keyFor: (actionId: string) => string) => (event: KeyboardEvent) => {
    if (event.defaultPrevented || isEditableTarget(event.target)) return
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const direction = directionOf(event, keyFor)
    if (direction === undefined) handleConfirm(event, options)
    else handleMove(event, direction, options)
  }

export const useOptionNavigation = (options: UseOptionNavigationOptions): void => {
  const { key: keyFor } = useKeybindings()
  const { enabled, count, index, onIndexChange, onConfirm, orientation, columns, containerRef, isDisabled } = options

  useEffect(() => {
    if (!enabled || count <= 0) return
    const handler = createKeydownHandler(
      { count, index, onIndexChange, onConfirm, orientation, columns, enabled, containerRef, isDisabled },
      keyFor,
    )
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, count, index, onIndexChange, onConfirm, orientation, columns, containerRef, isDisabled, keyFor])
}
