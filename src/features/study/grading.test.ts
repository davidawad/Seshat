import { describe, expect, it } from 'vitest'
import type { ClozeContent, McqContent, ShortAnswerContent } from '../../types'
import {
  attemptLabel,
  correctAnswerLabel,
  initialAttempt,
  isAttemptComplete,
  isCorrect,
  normalizeAnswer,
} from './grading'

const shortAnswer: ShortAnswerContent = {
  kind: 'short-answer',
  answer: 'Mitochondria',
  acceptableAnswers: ['the mitochondria'],
}

const cloze: ClozeContent = {
  kind: 'cloze',
  text: 'The mitochondria is the {{powerhouse}} of the cell',
}

const mcq: McqContent = {
  kind: 'mcq',
  options: ['Nucleus', 'Mitochondria', 'Ribosome'],
  correctIndex: 1,
}

describe('normalizeAnswer', () => {
  it('lowercases and trims', () => {
    expect(normalizeAnswer('  Mitochondria  ')).toBe('mitochondria')
  })

  it('collapses internal whitespace', () => {
    expect(normalizeAnswer('the   powerhouse')).toBe('the powerhouse')
  })

  it('strips trailing punctuation', () => {
    expect(normalizeAnswer('Powerhouse.')).toBe('powerhouse')
    expect(normalizeAnswer('Powerhouse!!')).toBe('powerhouse')
    expect(normalizeAnswer('"Powerhouse"')).toBe('"powerhouse')
  })
})

describe('short-answer grading', () => {
  it('accepts an exact match, case-insensitively', () => {
    const attempt = { kind: 'short-answer' as const, response: 'mitochondria' }
    expect(isCorrect(shortAnswer, attempt)).toBe(true)
  })

  it('accepts an acceptable-answers match', () => {
    const attempt = { kind: 'short-answer' as const, response: 'The Mitochondria' }
    expect(isCorrect(shortAnswer, attempt)).toBe(true)
  })

  it('tolerates extra whitespace and trailing punctuation', () => {
    const attempt = { kind: 'short-answer' as const, response: '  mitochondria.  ' }
    expect(isCorrect(shortAnswer, attempt)).toBe(true)
  })

  it('rejects a wrong answer', () => {
    const attempt = { kind: 'short-answer' as const, response: 'nucleus' }
    expect(isCorrect(shortAnswer, attempt)).toBe(false)
  })
})

describe('cloze grading', () => {
  it('accepts the deleted word, case-insensitively', () => {
    const attempt = { kind: 'cloze' as const, response: 'Powerhouse' }
    expect(isCorrect(cloze, attempt)).toBe(true)
  })

  it('rejects a wrong word', () => {
    const attempt = { kind: 'cloze' as const, response: 'engine' }
    expect(isCorrect(cloze, attempt)).toBe(false)
  })
})

describe('mcq grading', () => {
  it('accepts the correct index', () => {
    const attempt = { kind: 'mcq' as const, selectedIndex: 1 }
    expect(isCorrect(mcq, attempt)).toBe(true)
  })

  it('rejects a wrong index', () => {
    const attempt = { kind: 'mcq' as const, selectedIndex: 0 }
    expect(isCorrect(mcq, attempt)).toBe(false)
  })

  it('rejects an unselected attempt', () => {
    const attempt = { kind: 'mcq' as const, selectedIndex: null }
    expect(isCorrect(mcq, attempt)).toBe(false)
  })
})

describe('isAttemptComplete', () => {
  it('requires non-blank text for short-answer and cloze', () => {
    expect(isAttemptComplete(shortAnswer, { kind: 'short-answer', response: '   ' })).toBe(false)
    expect(isAttemptComplete(shortAnswer, { kind: 'short-answer', response: 'x' })).toBe(true)
    expect(isAttemptComplete(cloze, { kind: 'cloze', response: '' })).toBe(false)
  })

  it('requires a selection for mcq', () => {
    expect(isAttemptComplete(mcq, { kind: 'mcq', selectedIndex: null })).toBe(false)
    expect(isAttemptComplete(mcq, { kind: 'mcq', selectedIndex: 0 })).toBe(true)
  })
})

describe('correctAnswerLabel', () => {
  it('returns the canonical answer per content kind', () => {
    expect(correctAnswerLabel(shortAnswer)).toBe('Mitochondria')
    expect(correctAnswerLabel(cloze)).toBe('powerhouse')
    expect(correctAnswerLabel(mcq)).toBe('Mitochondria')
  })
})

describe('attemptLabel', () => {
  it('echoes back free-text responses', () => {
    expect(attemptLabel(shortAnswer, { kind: 'short-answer', response: 'nucleus' })).toBe('nucleus')
    expect(attemptLabel(cloze, { kind: 'cloze', response: 'engine' })).toBe('engine')
  })

  it('resolves the selected mcq option text', () => {
    expect(attemptLabel(mcq, { kind: 'mcq', selectedIndex: 0 })).toBe('Nucleus')
    expect(attemptLabel(mcq, { kind: 'mcq', selectedIndex: null })).toBe('')
  })
})

describe('initialAttempt', () => {
  it('seeds an empty attempt matching the content kind', () => {
    expect(initialAttempt(shortAnswer)).toEqual({ kind: 'short-answer', response: '' })
    expect(initialAttempt(cloze)).toEqual({ kind: 'cloze', response: '' })
    expect(initialAttempt(mcq)).toEqual({ kind: 'mcq', selectedIndex: null })
  })
})
