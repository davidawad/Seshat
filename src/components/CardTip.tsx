import { type ReactNode, useEffect, useState } from 'react'
import { TESTIDS } from '../lib/testids'
import './card-tip.css'

const EXIT_MS = 220

const prefersReducedMotion = (): boolean =>
  document.documentElement.dataset['reducedMotion'] === 'true' ||
  (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

/**
 * The "card tip": a compact single-line footer anchored to the bottom edge of
 * a card face ("Press [Space] to flip"). It is absolutely positioned inside
 * the face (see card-tip.css), so it turns with the card and never affects the
 * card's size or text layout. While `open` is false it fades out and then
 * unmounts (instantly under reduced motion).
 */
export const CardTip = ({
  label = 'Shortcut',
  open,
  children,
}: {
  readonly label?: string | null /** null: no label, for narrow cards */
  readonly open: boolean
  readonly children: ReactNode
}) => {
  const [gone, setGone] = useState(!open)
  if (open && gone) setGone(false)

  useEffect(() => {
    if (open) return
    const timer = window.setTimeout(() => setGone(true), prefersReducedMotion() ? 0 : EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [open])

  if (gone) return null
  return (
    <p className={open ? 'card-tip' : 'card-tip is-leaving'} data-testid={TESTIDS.cardTip}>
      {label !== null && <span className="card-tip-label">{label}</span>}
      <span className="card-tip-text">{children}</span>
    </p>
  )
}
