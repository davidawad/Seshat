import type { ReactNode } from 'react'
import './card-tip.css'

/**
 * The "card tip": a tinted strip attached to the bottom edge of a card that
 * names the shortcut to use ("Press [Space] to flip"). Wrap the card and the
 * tip in `.card-with-tip` so the card's bottom corners square off and the two
 * read as one object.
 */
export const CardTip = ({
  label = 'Shortcut',
  children,
}: {
  readonly label?: string
  readonly children: ReactNode
}) => (
  <p className="card-tip">
    <span className="card-tip-label">{label}</span>
    <span>{children}</span>
  </p>
)
