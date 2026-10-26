import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// seshat-brc: jsdom does no layout, so these guard the CSS contract; e2e/real-browser.mjs (`just e2e`)
// measures documentElement.scrollHeight <= innerHeight at 1280x720 and 1280x869 in a real browser.
describe('fit-to-viewport shell', () => {
  const css = readFileSync('src/index.css', 'utf8')
  const desktop = /@media \(min-width: 641px\) \{([\s\S]*?)\n\}\n\n\/\* Compact page title row/.exec(css)?.[1] ?? ''

  it('makes the desktop shell one viewport tall', () => {
    expect(/\.app-shell \{([^}]*)\}/.exec(desktop)?.[1] ?? '').toMatch(/height:\s*100dvh\s*;/)
  })

  it('scrolls inside .app-main, never the document', () => {
    const rules = /\.app-main \{([^}]*)\}/.exec(desktop)?.[1] ?? ''
    expect(rules).toMatch(/overflow-y:\s*auto\s*;/)
    expect(rules).toMatch(/min-height:\s*0\s*;/)
    expect(rules).toMatch(/position:\s*relative\s*;/)
  })

  it('lets the study card panel shrink below its 5:3 ratio before anything scrolls', () => {
    const study = readFileSync('src/features/study/review-session.css', 'utf8')
    const rules =
      /@media \(min-width: 641px\) \{[\s\S]*?\.illuminated-panel\.study-panel \{([^}]*)\}/.exec(study)?.[1] ?? ''
    expect(rules).toMatch(/flex:\s*1 1 auto\s*;/)
    expect(rules).toMatch(/min-height:\s*8rem\s*;/)
  })

  it('fits the set detail page: fit-page, side-by-side body, bounded term scroll (seshat-lse)', () => {
    const detail = readFileSync('src/features/sets/SetDetail.tsx', 'utf8')
    expect(detail).toMatch(/className="set-detail fit-page"/)
    const sets = readFileSync('src/features/sets/sets.css', 'utf8')
    const block = /seshat-lse[\s\S]*$/.exec(sets)?.[0] ?? ''
    expect(/\.set-detail-body \{([^}]*)\}/.exec(block)?.[1] ?? '').toMatch(/grid-template-columns:/)
    const scroll = /\.set-detail-terms \.set-term-scroll \{([^}]*)\}/.exec(block)?.[1] ?? ''
    expect(scroll).toMatch(/flex:\s*1 1 0\s*;/)
    expect(scroll).toMatch(/min-height:\s*0\s*;/)
  })

  it('does not pin the footer on phones', () => {
    expect(/\.app-footer \{\s*position:\s*static;/.test(css)).toBe(true)
  })
})
