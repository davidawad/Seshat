import type { CSSProperties, ReactNode, RefObject } from 'react'

/** At most this many options share one desktop row; more wrap onto further rows of the same width. */
const MAX_OPTION_COLUMNS = 4

/** An option this short (a number, a letter, a year) can share a phone row with another. */
const SHORT_OPTION_MAX_CHARS = 8

/** True when every option is short enough for two columns on a phone (numeric answers, single words). */
const areOptionsShort = (labels: readonly string[]): boolean =>
  labels.every((label) => label.trim().length <= SHORT_OPTION_MAX_CHARS)

interface OptionGridProps {
  readonly labels: readonly string[]
  readonly containerRef: RefObject<HTMLDivElement | null>
  readonly role: 'radiogroup' | 'group'
  readonly testId: string
  readonly ariaLabel?: string
  readonly ariaLabelledBy?: string
  readonly children: ReactNode
}

/**
 * The answer options as a CSS grid that lives OUTSIDE the card: one horizontal row of up to four on
 * a wide screen; on a phone two columns when every option is short, else one per row (see
 * `.study-mcq-options` in review-session.css). The keyboard hooks measure this grid's real column
 * count (`useOptionNavigation` with orientation 'grid'), so arrow keys always match what is drawn.
 */
export const OptionGrid = ({
  labels,
  containerRef,
  role,
  testId,
  ariaLabel,
  ariaLabelledBy,
  children,
}: OptionGridProps) => (
  <div
    ref={containerRef}
    role={role}
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledBy}
    className="study-mcq-options"
    data-testid={testId}
    data-length={areOptionsShort(labels) ? 'short' : 'long'}
    style={{ '--option-columns': Math.min(labels.length, MAX_OPTION_COLUMNS) } as CSSProperties}
  >
    {children}
  </div>
)
