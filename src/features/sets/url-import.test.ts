import { describe, expect, it } from 'vitest'
import { parseImportParam } from './url-import'

describe('parseImportParam', () => {
  it('returns null when no param is present', () => {
    expect(parseImportParam(null)).toBeNull()
  })

  it('parses a valid full ExportedSet shape', () => {
    const exported = {
      seshatExportVersion: 1,
      name: 'Patent Bar Basics',
      description: 'MPEP starter set',
      tags: ['law'],
      cards: [
        {
          prompt: 'What does MPEP stand for?',
          content: { kind: 'short-answer', answer: 'Manual of Patent Examining Procedure', acceptableAnswers: [] },
          explanation: null,
          sourceRef: null,
          tags: [],
        },
      ],
    }
    const result = parseImportParam(JSON.stringify(exported))
    expect(result?.ok).toBe(true)
    if (result?.ok === true) {
      expect(result.value).toEqual(exported)
    }
  })

  it('parses a valid simple {name, terms} shape, filling in export defaults', () => {
    const result = parseImportParam(JSON.stringify({ name: 'My Set', terms: [{ term: 'A', definition: 'B' }] }))
    expect(result?.ok).toBe(true)
    if (result?.ok === true) {
      expect(result.value).toEqual({
        seshatExportVersion: 1,
        name: 'My Set',
        description: '',
        tags: [],
        cards: [
          {
            prompt: 'A',
            content: { kind: 'short-answer', answer: 'B', acceptableAnswers: [] },
            explanation: null,
            sourceRef: null,
            tags: [],
          },
        ],
      })
    }
  })

  it('rejects a bare-array simple shape with no name to fall back to', () => {
    const result = parseImportParam(JSON.stringify([{ term: 'A', definition: 'B' }]))
    expect(result?.ok).toBe(false)
    if (result?.ok === false) {
      expect(result.error).toMatch(/no set name/i)
    }
  })

  it('rejects malformed JSON without throwing', () => {
    const result = parseImportParam('{not valid json')
    expect(result?.ok).toBe(false)
    if (result?.ok === false) {
      expect(result.error).toMatch(/isn't valid JSON/i)
    }
  })

  it('rejects JSON that matches neither the full nor the simple schema', () => {
    const result = parseImportParam(JSON.stringify({ foo: 'bar' }))
    expect(result?.ok).toBe(false)
    if (result?.ok === false) {
      expect(result.error).toMatch(/doesn't match either format/i)
    }
  })

  it('rejects a full-shaped object with an invalid card content kind', () => {
    const result = parseImportParam(
      JSON.stringify({
        seshatExportVersion: 1,
        name: 'Bad Set',
        description: '',
        tags: [],
        cards: [{ prompt: 'x', content: { kind: 'not-a-real-kind' }, explanation: null, sourceRef: null, tags: [] }],
      }),
    )
    expect(result?.ok).toBe(false)
  })
})
