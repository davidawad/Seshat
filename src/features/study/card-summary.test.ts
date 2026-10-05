import { describe, expect, it } from 'vitest'
import type { ClozeContent, ImageOcclusionContent, McqContent, ShortAnswerContent, StudyCard } from '../../types'
import { cardFrontBack } from './card-summary'

const baseCard = {
  id: 'card-1' as StudyCard['id'],
  setId: 'set-1' as StudyCard['setId'],
  promptImage: null,
  explanation: null,
  sourceRef: null,
  tags: [] as string[],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  scheduling: {
    due: '2026-01-01T00:00:00.000Z',
    stability: 0,
    difficulty: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: 0,
    lapses: 0,
    state: 'New' as const,
    lastReview: null,
  },
}

describe('cardFrontBack', () => {
  it('reduces a short-answer card to prompt/answer', () => {
    const content: ShortAnswerContent = {
      kind: 'short-answer',
      answer: 'Mitochondria',
      acceptableAnswers: [],
      answerImage: null,
    }
    const card: StudyCard = { ...baseCard, prompt: 'Powerhouse of the cell?', content }
    expect(cardFrontBack(card)).toEqual({ front: 'Powerhouse of the cell?', back: 'Mitochondria' })
  })

  it('reduces a cloze card to a blanked front and the deleted answer as back', () => {
    const content: ClozeContent = { kind: 'cloze', text: 'The mitochondria is the {{powerhouse}} of the cell' }
    const card: StudyCard = { ...baseCard, prompt: 'Fill in the blank', content }
    const result = cardFrontBack(card)
    expect(result.front).toContain('_____')
    expect(result.back).toBe('powerhouse')
  })

  it('reduces an mcq card to prompt/correct-option', () => {
    const content: McqContent = { kind: 'mcq', options: ['Nucleus', 'Mitochondria', 'Ribosome'], correctIndex: 1 }
    const card: StudyCard = { ...baseCard, prompt: 'Powerhouse of the cell?', content }
    expect(cardFrontBack(card)).toEqual({ front: 'Powerhouse of the cell?', back: 'Mitochondria' })
  })

  it('reduces an image-occlusion card to prompt/first-region-label plus the image', () => {
    const content: ImageOcclusionContent = {
      kind: 'image-occlusion',
      image: null,
      imageDataUrl: 'data:image/jpeg;base64,AAAA',
      occlusions: [
        { id: 'r1', xPct: 10, yPct: 10, widthPct: 20, heightPct: 20, label: 'Nucleus' },
        { id: 'r2', xPct: 40, yPct: 40, widthPct: 20, heightPct: 20, label: 'Mitochondria' },
      ],
    }
    const card: StudyCard = { ...baseCard, prompt: 'Label the diagram', content }
    expect(cardFrontBack(card)).toEqual({
      front: 'Label the diagram',
      back: 'Nucleus',
      imageDataUrl: 'data:image/jpeg;base64,AAAA',
    })
  })

  const ref = {
    id: 'b'.repeat(64),
    mime: 'image/png' as const,
    width: 5,
    height: 4,
    bytes: 9,
    alt: '',
    decorative: false,
  }
  const occlusion = { id: 'r1', xPct: 1, yPct: 1, widthPct: 2, heightPct: 2, label: 'Part' }

  it('prefers a stored image over a legacy data URL on image-occlusion cards', () => {
    const content: ImageOcclusionContent = {
      kind: 'image-occlusion',
      image: ref,
      imageDataUrl: 'data:image/png;base64,AAAA',
      occlusions: [occlusion],
    }
    const result = cardFrontBack({ ...baseCard, prompt: 'p', content })
    expect(result.image).toEqual(ref)
    expect(result).not.toHaveProperty('imageDataUrl')
  })

  it('exposes the prompt image of non-image cards, and never overrides an occlusion image', () => {
    const content: ShortAnswerContent = { kind: 'short-answer', answer: 'a', acceptableAnswers: [], answerImage: null }
    expect(cardFrontBack({ ...baseCard, prompt: 'p', promptImage: ref, content }).image).toEqual(ref)
    const other = { ...ref, id: 'c'.repeat(64) }
    const occ: ImageOcclusionContent = { kind: 'image-occlusion', image: other, occlusions: [occlusion] }
    expect(cardFrontBack({ ...baseCard, prompt: 'p', promptImage: ref, content: occ }).image).toEqual(other)
  })

  it('returns no image for an occlusion card that has neither (invalid data) rather than throwing', () => {
    const content = { kind: 'image-occlusion', image: null, occlusions: [occlusion] } as ImageOcclusionContent
    expect(cardFrontBack({ ...baseCard, prompt: 'p', content })).toEqual({ front: 'p', back: 'Part' })
  })

  it('exposes a short-answer answerImage separately from the prompt image', () => {
    const answerImage = { ...ref, id: 'd'.repeat(64) }
    const content: ShortAnswerContent = { kind: 'short-answer', answer: 'a', acceptableAnswers: [], answerImage }
    const result = cardFrontBack({ ...baseCard, prompt: 'p', promptImage: ref, content })
    expect(result.answerImage).toEqual(answerImage)
    expect(result.image).toEqual(ref)
  })
})
