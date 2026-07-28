import { describe, expect, it } from 'vitest'
import type { ClozeContent, ImageOcclusionContent, McqContent, ShortAnswerContent, StudyCard } from '../../types'
import { cardFrontBack } from './card-summary'

const baseCard = {
  id: 'card-1' as StudyCard['id'],
  deckId: 'deck-1' as StudyCard['deckId'],
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
    const content: ShortAnswerContent = { kind: 'short-answer', answer: 'Mitochondria', acceptableAnswers: [] }
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
})
