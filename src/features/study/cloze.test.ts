import { describe, expect, it } from 'vitest'
import { blankedCloze, clozeAnswer, parseCloze } from './cloze'

describe('parseCloze', () => {
  it('splits text around a single deletion', () => {
    const parsed = parseCloze('The mitochondria is the {{powerhouse}} of the cell')
    expect(parsed).toEqual({
      before: 'The mitochondria is the ',
      answer: 'powerhouse',
      after: ' of the cell',
    })
  })

  it('trims whitespace inside the deletion', () => {
    const parsed = parseCloze('{{  Paris  }} is the capital of France')
    expect(parsed?.answer).toBe('Paris')
  })

  it('returns null when there is no deletion', () => {
    expect(parseCloze('No blanks here')).toBeNull()
  })

  it('returns null when the deletion is empty or whitespace-only', () => {
    expect(parseCloze('This has an {{ }} empty deletion')).toBeNull()
    expect(parseCloze('This has an {{}} empty deletion')).toBeNull()
  })

  it('only recognizes the first deletion when multiple are present', () => {
    const parsed = parseCloze('{{first}} and {{second}}')
    expect(parsed?.answer).toBe('first')
    expect(parsed?.after).toBe(' and {{second}}')
  })
})

describe('blankedCloze', () => {
  it('replaces the deletion with a blank marker', () => {
    expect(blankedCloze('The {{powerhouse}} of the cell')).toBe('The _____ of the cell')
  })

  it('supports a custom blank marker', () => {
    expect(blankedCloze('The {{powerhouse}} of the cell', '___')).toBe('The ___ of the cell')
  })

  it('returns the original text unchanged when there is no deletion', () => {
    expect(blankedCloze('No blanks here')).toBe('No blanks here')
  })
})

describe('clozeAnswer', () => {
  it('extracts the trimmed answer', () => {
    expect(clozeAnswer('The {{ powerhouse }} of the cell')).toBe('powerhouse')
  })

  it('returns null when there is no deletion', () => {
    expect(clozeAnswer('No blanks here')).toBeNull()
  })
})
