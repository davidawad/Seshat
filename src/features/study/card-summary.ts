import type { MediaRef } from '../../lib/media/types'
import type { CardContent, ImageOcclusionContent, StudyCard } from '../../types'
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
  /** The card's image as a MediaRef (image-occlusion `image`, else the card's `promptImage`). Absent when it has none. */
  readonly image?: MediaRef
  /** LEGACY inline data URL (image-occlusion cards not migrated yet). Present only when there is no `image`. */
  readonly imageDataUrl?: string
}

/** A stored image wins; the legacy data URL is only used while there is none. */
const occlusionImage = (content: ImageOcclusionContent): Pick<CardFrontBack, 'image' | 'imageDataUrl'> => {
  if (content.image !== null) return { image: content.image }
  return content.imageDataUrl === undefined ? {} : { imageDataUrl: content.imageDataUrl }
}

const contentFrontBack = (prompt: string, content: CardContent): CardFrontBack => {
  switch (content.kind) {
    case 'short-answer':
      return { front: prompt, back: content.answer }
    case 'cloze':
      // Unlike every other kind, `prompt` here is optional supplementary
      // context (a category-style label, e.g. "Fill in the blank") rather
      // than the actual question — the blanked sentence IS the question,
      // same as `front` for every other kind is just the one thing you'd
      // read to answer. Concatenating the two into one string used to
      // produce an unreadable label+sentence run-on everywhere `front` is
      // shown as a single atomic string (flashcards, Match/Blast/Blocks
      // tiles, Test mode questions, the set term list) — the dedicated
      // `ClozeCard.tsx` (default Study mode) already renders `prompt` as
      // its own separate, optional line above the sentence.
      return { front: blankedCloze(content.text), back: clozeAnswer(content.text) ?? content.text }
    case 'mcq':
      return { front: prompt, back: content.options[content.correctIndex] ?? '(unknown)' }
    case 'image-occlusion': {
      const first = content.occlusions[0]
      return { front: prompt, back: first?.label ?? '(unknown)', ...occlusionImage(content) }
    }
  }
}

/** The front/back pair for a full `StudyCard` (prompt + content together). */
export const cardFrontBack = (card: StudyCard): CardFrontBack => {
  const faces = contentFrontBack(card.prompt, card.content)
  const hasImage = faces.image !== undefined || faces.imageDataUrl !== undefined
  return card.promptImage !== null && !hasImage ? { ...faces, image: card.promptImage } : faces
}
