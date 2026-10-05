import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Category guard: wide code blocks and long bare URLs must not widen the page past a phone viewport.
describe('phone-width overflow guards', () => {
  const css = readFileSync('src/index.css', 'utf8')
  it('lets code blocks scroll inside themselves', () => {
    expect(/\.app-main pre \{([^}]*)\}/.exec(css)?.[1] ?? '').toMatch(/overflow-x:\s*auto\s*;/)
  })
  it('lets long links wrap', () => {
    expect(/\.app-main a \{([^}]*)\}/.exec(css)?.[1] ?? '').toMatch(/overflow-wrap:\s*anywhere\s*;/)
  })

  // Flashcards page (seshat-r5a): at 390px a long unbroken term, an image, or a 52-64rem card size
  // widened the page by up to 115px. These pin the CSS that prevents it (measured in a real browser).
  const block = (source: string, selector: string): string => {
    const escaped = selector.replace(/[.[\]]/g, '\\$&')
    return new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`).exec(source)?.[1] ?? ''
  }
  const flipCss = readFileSync('src/components/flip-card.css', 'utf8')
  const flashCss = readFileSync('src/features/flashcards/flashcards.css', 'utf8')
  const tipCss = readFileSync('src/components/card-tip.css', 'utf8')

  it('gives both card faces a definite, shrinkable column', () => {
    expect(block(flipCss, '.flip-card-inner')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/)
    expect(block(flipCss, '.flip-card-scene .flip-card-face')).toMatch(/min-width:\s*0\s*;/)
    expect(block(flipCss, '.flip-card-scene .flip-card-face')).toMatch(/overflow-wrap:\s*anywhere\s*;/)
    expect(block(flipCss, '.flip-card-image')).toMatch(/max-width:\s*100%\s*;/)
  })

  it.each(['.flashcard-stack', '.flashcard-controls', '.flashcard-tally'])(
    '%s never exceeds the viewport at any card size',
    (selector) => {
      const rules = block(flashCss, selector)
      expect(rules).toMatch(/width:\s*min\(100%,\s*var\(--card-max-width\)\)\s*;/)
      expect(rules).toMatch(/min-width:\s*0\s*;/)
    },
  )

  it('lets the phone control row and tip wrap', () => {
    expect(flashCss).toMatch(/max-width:\s*30rem\)[^@]*\.flashcard-grade-cluster \{[^}]*flex-wrap:\s*wrap/)
    expect(tipCss).toMatch(/max-width:\s*30rem\)[^@]*\.card-tip-text \{[^}]*white-space:\s*normal/)
  })
})
