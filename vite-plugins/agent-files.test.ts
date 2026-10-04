import { describe, expect, it } from 'vitest'
import { exportedSetSchema } from '../src/types.ts'
import { SCHEMA_PATH, buildImportSchema, buildLlmsFull, buildLlmsTxt } from './agent-files.ts'

describe('buildLlmsTxt', () => {
  it('follows the llms.txt layout: H1, blockquote, H2 link lists', () => {
    const lines = buildLlmsTxt('/').split('\n')
    expect(lines[0]).toBe('# Seshat')
    expect(lines.some((l) => l.startsWith('> '))).toBe(true)
    expect(lines.filter((l) => l.startsWith('## '))).toContain('## Optional')
  })

  it('prefixes every link with the deploy base', () => {
    for (const base of ['/', '/seshat/']) {
      const links = [...buildLlmsTxt(base).matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1])
      expect(links.length).toBeGreaterThan(5)
      for (const link of links) expect(link?.startsWith(base)).toBe(true)
      expect(links).toContain(`${base}${SCHEMA_PATH}`)
    }
  })
})

describe('buildLlmsFull', () => {
  it('labels and joins sources in order', () => {
    const out = buildLlmsFull([
      { name: 'a.md', text: 'one\n' },
      { name: 'b.txt', text: 'two' },
    ])
    expect(out.indexOf('a.md')).toBeLessThan(out.indexOf('b.txt'))
    expect(out).toContain('one')
    expect(out).toContain('two')
  })
})

describe('buildImportSchema', () => {
  const schema = buildImportSchema()

  it('offers the simple and full shapes', () => {
    expect(schema['$schema']).toContain('json-schema.org')
    expect(schema['anyOf']).toHaveLength(2)
  })

  it('is JSON-serializable', () => {
    expect(() => JSON.stringify(schema)).not.toThrow()
  })

  it('describes the same set the Zod export schema accepts', () => {
    const sample = {
      seshatExportVersion: 1,
      name: 'S',
      description: '',
      tags: [],
      cards: [
        {
          prompt: 'Q',
          content: { kind: 'short-answer', answer: 'A', acceptableAnswers: [] },
          explanation: null,
          sourceRef: null,
          tags: [],
        },
      ],
    }
    expect(exportedSetSchema.safeParse(sample).success).toBe(true)
    expect(JSON.stringify(schema)).toContain('seshatExportVersion')
  })
})
