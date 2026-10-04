import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { installA11yTestEnv } from './a11y-fixtures'
import { duplicatedTestIds, headingLevels, headingSkips, missingTestIds, unnamedInteractive } from './lib/a11y-audit'

installA11yTestEnv()

describe('accessibility audit helpers', () => {
  it('flags an unnamed button and ignores a named one', () => {
    const { container } = render(
      <div>
        <button type="button" aria-label="ok" />
        <button type="button" />
      </div>,
    )
    expect(unnamedInteractive(container)).toHaveLength(1)
  })

  it('flags skipped heading levels and a missing h1', () => {
    expect(headingSkips([1, 2, 3, 2, 3])).toEqual([])
    expect(headingSkips([1, 3])).toEqual(['h3 follows h1'])
    expect(headingSkips([2])).toEqual(['h2 follows nothing'])
  })

  it('reads aria-level over the tag name', () => {
    const { container } = render(
      <div>
        <div role="heading" aria-level={4}>
          x
        </div>
        <h2>y</h2>
      </div>,
    )
    expect(headingLevels(container)).toEqual([4, 2])
  })

  it('reports missing and duplicated test ids', () => {
    const { container } = render(
      <div>
        <i data-testid="a" />
        <i data-testid="b" />
        <i data-testid="b" />
      </div>,
    )
    expect(missingTestIds(container, ['a', 'c'])).toEqual(['c'])
    expect(duplicatedTestIds(container, ['a', 'b'])).toEqual(['b'])
  })
})
