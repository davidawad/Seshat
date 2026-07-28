import type { ReactNode } from 'react'

const TAGS = {
  div: 'div',
  p: 'p',
  span: 'span',
  section: 'section',
  article: 'article',
  fieldset: 'fieldset',
  li: 'li',
} as const

export interface LegibleProps {
  /** @default 'div' */
  readonly as?: keyof typeof TAGS
  /** Constrain to the configured reading measure (55-75ch). @default true */
  readonly measure?: boolean
  readonly className?: string
  readonly children: ReactNode
  readonly id?: string
  /** For a block that announces itself to screen readers when its content changes. */
  readonly 'aria-live'?: 'polite' | 'assertive' | 'off'
}

/**
 * The single reusable primitive for rendering the actual material someone
 * is studying — card prompts, answers, options, explanations, image-
 * occlusion labels, and their previews/editors. Applies the research-
 * backed legibility cluster (see research/legibility/*.md and
 * tokens.css's top comment) in one place instead of hand-typed class
 * names scattered across every feature:
 *
 *   - the Settings-driven typeface (Atkinson Hyperlegible by default)
 *   - 11.5-13pt body size, 1.4-1.5 line height
 *   - a 55-75 character measure (line length), on by default
 *
 * This is deliberately NOT applied to Seshat's own UI chrome (nav,
 * buttons, labels) — that uses a fixed typeface regardless of the
 * reader's choice. See tokens.css's top comment for the full rationale.
 */
export const Legible = ({ as = 'div', measure = true, className, children, id, ...rest }: LegibleProps) => {
  const Tag = TAGS[as]
  const classes = ['legible', measure ? 'legible-measure' : null, className ?? null].filter(Boolean).join(' ')
  return (
    <Tag className={classes} id={id} aria-live={rest['aria-live']}>
      {children}
    </Tag>
  )
}
