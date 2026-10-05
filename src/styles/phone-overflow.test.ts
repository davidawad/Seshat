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
})
