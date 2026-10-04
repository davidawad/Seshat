import { within } from '@testing-library/react'

type Role = string

const queryAllByRole = (container: HTMLElement, role: Role, hasName?: (accessibleName: string) => boolean) =>
  hasName === undefined
    ? within(container).queryAllByRole(role)
    : within(container).queryAllByRole(role, { name: (accessibleName) => hasName(accessibleName) })

/**
 * Accessibility-tree helpers for tests (see `src/a11y.test.tsx`). Most
 * browser agents drive the page through the accessibility tree, so an
 * interactive element with no accessible name is invisible to them.
 */

export const INTERACTIVE_ROLES: readonly Role[] = [
  'button',
  'link',
  'textbox',
  'searchbox',
  'combobox',
  'switch',
  'radio',
  'checkbox',
  'slider',
  'spinbutton',
]

/** Short, readable description of an element for failure messages. */
export const describeElement = (element: Element): string => {
  const testId = element.getAttribute('data-testid')
  const suffix = testId === null ? '' : `[data-testid=${testId}]`
  return `${element.tagName.toLowerCase()}${suffix}: ${element.outerHTML.slice(0, 100)}`
}

/** Every interactive element under `container` whose computed accessible name is empty. */
export const unnamedInteractive = (container: HTMLElement): readonly string[] =>
  INTERACTIVE_ROLES.flatMap((role) => {
    const all = queryAllByRole(container, role)
    const named = new Set(queryAllByRole(container, role, (name) => name.trim().length > 0))
    return all.filter((element) => !named.has(element)).map(describeElement)
  })

/** Levels (1-6) of the headings under `container`, in document order. */
export const headingLevels = (container: HTMLElement): readonly number[] =>
  queryAllByRole(container, 'heading').map((heading) => {
    const explicit = Number(heading.getAttribute('aria-level'))
    return explicit >= 1 ? explicit : Number(heading.tagName.slice(1))
  })

/**
 * Problems in a sequence of heading levels: it must start at h1 and never
 * descend by more than one level at a time (going back up any distance is fine).
 */
export const headingSkips = (levels: readonly number[]): readonly string[] =>
  levels.flatMap((level, index) => {
    const previous = index === 0 ? 0 : (levels[index - 1] ?? 0)
    return level > previous + 1 ? [`h${level} follows ${previous === 0 ? 'nothing' : `h${previous}`}`] : []
  })

/** Test ids from `ids` that no element under `container` carries. */
export const missingTestIds = (container: HTMLElement, ids: readonly string[]): readonly string[] =>
  ids.filter((id) => container.querySelector(`[data-testid="${id}"]`) === null)

/** Test ids that appear on more than one element under `container` (ambiguous selectors), among `ids`. */
export const duplicatedTestIds = (container: HTMLElement, ids: readonly string[]): readonly string[] =>
  ids.filter((id) => container.querySelectorAll(`[data-testid="${id}"]`).length > 1)
