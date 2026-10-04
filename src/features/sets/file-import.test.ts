import { describe, expect, it } from 'vitest'
import { countPastedCards, parseImportFile, parsePastedSet } from './file-import'

const richExport = {
  seshatExportVersion: 1,
  name: 'Rich',
  description: '',
  tags: ['x'],
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

describe('parseImportFile', () => {
  it('accepts Seshat exports', () => {
    const result = parseImportFile(JSON.stringify(richExport), '')
    expect(result).toMatchObject({ ok: true, value: { name: 'Rich', tags: ['x'] } })
  })

  it('accepts a plain term/definition array using the fallback name', () => {
    const result = parseImportFile(JSON.stringify([{ term: 'a', definition: 'b' }]), '  Fallback ')
    expect(result).toMatchObject({ ok: true, value: { name: 'Fallback' } })
    if (result.ok) expect(result.value.cards).toHaveLength(1)
  })

  it('prefers the name inside a simple file', () => {
    const json = JSON.stringify({ name: 'Inner', terms: [{ term: 'a', definition: 'b' }] })
    expect(parseImportFile(json, 'Outer')).toMatchObject({ ok: true, value: { name: 'Inner' } })
  })

  it('asks for a name when neither file nor field has one', () => {
    const result = parseImportFile(JSON.stringify([{ term: 'a', definition: 'b' }]), ' ')
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(result.error).toMatch(/no set name/)
  })

  it('rejects invalid JSON and unknown shapes', () => {
    expect(parseImportFile('{nope', '')).toEqual({ ok: false, error: 'That file is not valid JSON.' })
    expect(parseImportFile('{"a":1}', 'x')).toMatchObject({ ok: false })
  })
})

describe('parsePastedSet / countPastedCards', () => {
  it('requires a name', () => {
    expect(parsePastedSet('a\tb', '  ')).toEqual({ ok: false, error: 'Enter a set name.' })
  })

  it('surfaces parse errors and builds sets', () => {
    expect(parsePastedSet('', 'N')).toMatchObject({ ok: false })
    const result = parsePastedSet('a\tb\nc,d', ' N ')
    expect(result).toMatchObject({ ok: true, value: { name: 'N' } })
    if (result.ok) expect(result.value.cards).toHaveLength(2)
  })

  it('counts parsed lines, 0 when nothing parses', () => {
    expect(countPastedCards('a\tb\nc,d\n\nbad')).toBe(2)
    expect(countPastedCards('')).toBe(0)
    expect(countPastedCards('nothing here')).toBe(0)
  })
})
