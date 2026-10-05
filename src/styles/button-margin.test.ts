import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Category guard: a default bottom margin on <button> leaves a stray strip
// under every segmented pill group (match pair picker, view toggle, ...).
describe('global button spacing', () => {
  it('gives buttons no default bottom margin', () => {
    const css = readFileSync('src/styles/typography.css', 'utf8')
    const rule = /\*\/\nbutton \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(rule).toMatch(/margin-bottom:\s*0\s*;/)
  })
})
