import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { ClozeContent, ImageOcclusionContent, McqContent, ShortAnswerContent } from '../../types'
import {
  type Attempt,
  attemptLabel,
  correctAnswerLabel,
  initialAttempt,
  isAttemptComplete,
  isCorrect,
  normalizeAnswer,
  pickOcclusionRegion,
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

const imageOcclusion: ImageOcclusionContent = {
  kind: 'image-occlusion',
  imageDataUrl: 'data:image/jpeg;base64,AAAA',
  occlusions: [
    { id: 'r1', xPct: 10, yPct: 10, widthPct: 20, heightPct: 20, label: 'Nucleus' },
    { id: 'r2', xPct: 40, yPct: 40, widthPct: 20, heightPct: 20, label: 'Mitochondria' },
  ],
}

const imageOcclusionAttempt = (targetRegionId: string, response: string): Attempt => ({
  kind: 'image-occlusion',
  targetRegionId,
  response,
})

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

  it('is idempotent for any string — normalizing an already-normalized answer changes nothing', () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const once = normalizeAnswer(input)
        expect(normalizeAnswer(once)).toBe(once)
      }),
    )
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
    expect(correctAnswerLabel(shortAnswer, { kind: 'short-answer', response: '' })).toBe('Mitochondria')
    expect(correctAnswerLabel(cloze, { kind: 'cloze', response: '' })).toBe('powerhouse')
    expect(correctAnswerLabel(mcq, { kind: 'mcq', selectedIndex: null })).toBe('Mitochondria')
  })

  it('returns the tested region label for image-occlusion', () => {
    expect(correctAnswerLabel(imageOcclusion, imageOcclusionAttempt('r1', ''))).toBe('Nucleus')
    expect(correctAnswerLabel(imageOcclusion, imageOcclusionAttempt('r2', ''))).toBe('Mitochondria')
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

  it('seeds an image-occlusion attempt targeting one of the content regions', () => {
    const attempt = initialAttempt(imageOcclusion)
    expect(attempt.kind).toBe('image-occlusion')
    expect(attempt).toMatchObject({ response: '' })
    expect(attempt.kind === 'image-occlusion' && ['r1', 'r2'].includes(attempt.targetRegionId)).toBe(true)
  })
})

describe('pickOcclusionRegion', () => {
  it('always returns one of the content regions', () => {
    for (let i = 0; i < 20; i++) {
      const region = pickOcclusionRegion(imageOcclusion)
      expect(['r1', 'r2']).toContain(region.id)
    }
  })

  it('returns the only region when there is just one', () => {
    const single: ImageOcclusionContent = {
      kind: 'image-occlusion',
      imageDataUrl: imageOcclusion.imageDataUrl,
      occlusions: [imageOcclusion.occlusions[0]!],
    }
    expect(pickOcclusionRegion(single).id).toBe('r1')
  })
})

describe('image-occlusion grading', () => {
  it('accepts the tested region label, case-insensitively and trimmed', () => {
    expect(isCorrect(imageOcclusion, imageOcclusionAttempt('r1', '  nucleus  '))).toBe(true)
    expect(isCorrect(imageOcclusion, imageOcclusionAttempt('r2', 'Mitochondria.'))).toBe(true)
  })

  it('rejects a label that belongs to a different region', () => {
    expect(isCorrect(imageOcclusion, imageOcclusionAttempt('r1', 'Mitochondria'))).toBe(false)
  })

  it('rejects an unknown target region id', () => {
    expect(isCorrect(imageOcclusion, imageOcclusionAttempt('does-not-exist', 'Nucleus'))).toBe(false)
  })

  it('requires non-blank text to be complete', () => {
    expect(isAttemptComplete(imageOcclusion, imageOcclusionAttempt('r1', '   '))).toBe(false)
    expect(isAttemptComplete(imageOcclusion, imageOcclusionAttempt('r1', 'Nucleus'))).toBe(true)
  })

  it('echoes back the free-text response as the attempt label', () => {
    expect(attemptLabel(imageOcclusion, imageOcclusionAttempt('r1', 'my guess'))).toBe('my guess')
  })
})
