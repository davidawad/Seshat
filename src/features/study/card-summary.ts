import type { CardContent, StudyCard } from '../../types'
import { blankedCloze, clozeAnswer } from './cloze'

/**
 * Reduces any card content kind to a plain front/back pair. The recall-
 * first default study mode renders each kind with its own dedicated
 * component (ShortAnswerCard, ClozeCard, ...), but the legacy-style study
 * modes (Flashcards, Match, Test) and the simple term/definition JSON
 * export all need one uniform shape to work across every kind at once.
 */
export interface CardFrontBack {
  readonly front: string
  readonly back: string
  /** Present only for image-occlusion cards. */
  readonly imageDataUrl?: string
}

const contentFrontBack = (prompt: string, content: CardContent): CardFrontBack => {
  switch (content.kind) {
    case 'short-answer':
      return { front: prompt, back: content.answer }
    case 'cloze':
      return { front: `${prompt}\n${blankedCloze(content.text)}`, back: clozeAnswer(content.text) ?? content.text }
    case 'mcq':
      return { front: prompt, back: content.options[content.correctIndex] ?? '(unknown)' }
    case 'image-occlusion': {
      const first = content.occlusions[0]
      return { front: prompt, back: first?.label ?? '(unknown)', imageDataUrl: content.imageDataUrl }
    }
  }
}

/** The front/back pair for a full `StudyCard` (prompt + content together). */
export const cardFrontBack = (card: StudyCard): CardFrontBack => contentFrontBack(card.prompt, card.content)
