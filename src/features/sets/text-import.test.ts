import { describe, expect, it } from 'vitest'
import { parseTermDefinitionText } from './text-import'

describe('parseTermDefinitionText', () => {
  it('parses tab-separated term/definition lines', () => {
    const result = parseTermDefinitionText(
      'mitosis\tcell division producing two identical daughter cells\nallele\tone version of a gene',
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toHaveLength(2)
    expect(result.value[0]).toEqual({
      prompt: 'mitosis',
      promptImage: null,
      content: {
        kind: 'short-answer',
        answer: 'cell division producing two identical daughter cells',
        acceptableAnswers: [],
        answerImage: null,
      },
      explanation: null,
      sourceRef: null,
      tags: [],
    })
    expect(result.value[1]?.prompt).toBe('allele')
  })

  it('falls back to a comma delimiter when a line has no tab', () => {
    const result = parseTermDefinitionText('term,definition of term')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual([
      {
        prompt: 'term',
        promptImage: null,
        content: { kind: 'short-answer', answer: 'definition of term', acceptableAnswers: [], answerImage: null },
        explanation: null,
        sourceRef: null,
        tags: [],
      },
    ])
  })

  it('prefers the tab delimiter over commas when both are present', () => {
    const result = parseTermDefinitionText('term\tdefinition, with a comma')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value[0]?.content).toEqual({
      kind: 'short-answer',
      answer: 'definition, with a comma',
      acceptableAnswers: [],
      answerImage: null,
    })
  })

  it('skips blank lines', () => {
    const result = parseTermDefinitionText('a\t1\n\n\nb\t2\n   \n')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toHaveLength(2)
  })

  it('skips lines with no delimiter and no usable definition', () => {
    const result = parseTermDefinitionText('just a line with no delimiter\nterm\tdefinition')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toHaveLength(1)
    expect(result.value[0]?.prompt).toBe('term')
  })

  it('trims whitespace around term and definition', () => {
    const result = parseTermDefinitionText('  term  \t  definition  ')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const card = result.value[0]
    expect(card?.prompt).toBe('term')
    expect(card?.content).toEqual({
      kind: 'short-answer',
      answer: 'definition',
      acceptableAnswers: [],
      answerImage: null,
    })
  })

  it('returns an error for empty input', () => {
    const result = parseTermDefinitionText('')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('nothing to import')
  })

  it('returns an error for whitespace-only input', () => {
    const result = parseTermDefinitionText('   \n  \n')
    expect(result.ok).toBe(false)
  })

  it('returns an error when no line parses', () => {
    const result = parseTermDefinitionText('no delimiters here\nor here either')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('No lines could be parsed')
  })

  it('skips a line with a delimiter but an empty term or definition', () => {
    const result = parseTermDefinitionText('\tdefinition only\nterm only\t\nterm\tdefinition')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toHaveLength(1)
    expect(result.value[0]?.prompt).toBe('term')
  })

  it('keeps commas inside a CSV-quoted term and unquotes the definition', () => {
    const result = parseTermDefinitionText('"Paris, France","Capital of ""France"""')
    expect(result.ok && result.value.map((card) => [card.prompt, card.content])).toEqual([
      [
        'Paris, France',
        { kind: 'short-answer', answer: 'Capital of "France"', acceptableAnswers: [], answerImage: null },
      ],
    ])
  })

  it('drops a leading term,definition header row but not later lookalikes', () => {
    const result = parseTermDefinitionText('Term,Definition\nDefinition,a meaning\nx,y')
    expect(result.ok && result.value.map((card) => card.prompt)).toEqual(['Definition', 'x'])
    const tsv = parseTermDefinitionText('front\tback\na\tb')
    expect(tsv.ok && tsv.value).toHaveLength(1)
  })

  it('handles CRLF line endings from spreadsheet exports', () => {
    const result = parseTermDefinitionText('a,b\r\nc,d\r\n')
    expect(result.ok && result.value.map((card) => card.prompt)).toEqual(['a', 'c'])
  })
})
