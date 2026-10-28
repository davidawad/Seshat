import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MathText } from './MathText'

afterEach(() => cleanup())

describe('MathText', () => {
  it('renders plain text untouched', () => {
    render(
      <p data-testid="t">
        <MathText text="no formula, costs $5 and $10" />
      </p>,
    )
    expect(screen.getByTestId('t')).toHaveTextContent('no formula, costs $5 and $10')
    expect(document.querySelector('.math')).toBeNull()
  })

  it('shows the TeX source first, then typesets it with MathJax as SVG', async () => {
    render(
      <p data-testid="t">
        <MathText text="Area is $\pi r^2$ always" />
      </p>,
    )
    expect(screen.getByTestId('t')).toHaveTextContent('Area is')
    await waitFor(() => expect(document.querySelector('.math svg')).not.toBeNull(), { timeout: 10_000 })
    const formula = document.querySelector('.math')
    expect(formula).toHaveAttribute('role', 'img')
    expect(formula).toHaveAttribute('aria-label', '\\pi r^2')
    expect(screen.getByTestId('t')).toHaveTextContent('always')
  })

  it('typesets display math and rarer alphabets that load font files on demand', async () => {
    render(<MathText text="$$x \in \mathbb{R}^n$$" />)
    await waitFor(() => expect(document.querySelector('.math-display svg')).not.toBeNull(), { timeout: 10_000 })
  })

  it('never emits links from imported TeX', async () => {
    render(<MathText text="$\href{https://example.com}{x}$" />)
    await waitFor(() => expect(document.querySelector('.math')).not.toBeNull())
    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(document.querySelector('.math a')).toBeNull()
  })
})
