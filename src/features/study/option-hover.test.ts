import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/features/study/review-session.css', 'utf8')

describe('MCQ option hover style', () => {
  it('only exists inside a (hover: hover) media query, so touch taps never leave it stuck', () => {
    const hoverRules = [...css.matchAll(/\.study-mcq-option:hover/g)]
    expect(hoverRules.length).toBeGreaterThan(0)
    const outside = css.replace(/@media \(hover: hover\) \{[\s\S]*?\n\}\n/g, '')
    expect(outside).not.toContain(':hover')
  })
})
