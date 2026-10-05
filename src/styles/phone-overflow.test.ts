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

  it('breaks long typed text echoed in paragraphs (sets search "No sets match ...")', () => {
    expect(/\.app-main p \{([^}]*)\}/.exec(css)?.[1] ?? '').toMatch(/overflow-wrap:\s*break-word\s*;/)
  })

  it('breaks long set names in page headings', () => {
    expect(/\.app-main :is\(h1, h2, h3, h4\) \{([^}]*)\}/.exec(css)?.[1] ?? '').toMatch(/overflow-wrap:\s*anywhere\s*;/)
  })
  it('wraps long tags inside their pill', () => {
    const rules = /\.tag-chips li \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(rules).toMatch(/overflow-wrap:\s*anywhere\s*;/)
    expect(rules).toMatch(/max-width:\s*100%\s*;/)
  })

  it('wraps long answers inside Study/Learn multiple-choice buttons', () => {
    const rules =
      /\.study-mcq-option \{([^}]*)\}/.exec(readFileSync('src/features/study/review-session.css', 'utf8'))?.[1] ?? ''
    expect(rules).toMatch(/overflow-wrap:\s*anywhere\s*;/)
    expect(rules).toMatch(/max-width:\s*100%\s*;/)
  })

  it('lets the set page title column shrink so a long description wraps beside the action buttons', () => {
    const setsCss = readFileSync('src/features/sets/sets.css', 'utf8')
    const rules = /\.set-detail-header > :first-child \{([^}]*)\}/.exec(setsCss)?.[1] ?? ''
    expect(rules).toMatch(/min-width:\s*0\s*;/)
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

  it('clips the graded card sliding off the side so the page never scrolls sideways mid-animation', () => {
    const rules = block(flashCss, '.flashcard-session')
    expect(rules).toMatch(/overflow-x:\s*clip\s*;/)
    expect(rules).toMatch(/overflow-clip-margin:/)
  })

  it('lets the phone control row and tip wrap', () => {
    expect(flashCss).toMatch(/max-width:\s*30rem\)[^@]*\.flashcard-grade-cluster \{[^}]*flex-wrap:\s*wrap/)
    expect(tipCss).toMatch(/max-width:\s*30rem\)[^@]*\.card-tip-text \{[^}]*white-space:\s*normal/)
  })
})
