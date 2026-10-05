import { matchesBinding } from '../../lib/keybindings'
import type { CardSize, FlashcardsFront } from '../../types'

/** What the Options modal controls, resolved from Settings — the one place the two settings are interpreted. */
export interface FlashcardOptions {
  readonly trackProgress: boolean
  readonly front: FlashcardsFront
  readonly cardSize: CardSize
}

export const FRONT_LABELS: Readonly<Record<FlashcardsFront, string>> = {
  term: 'Term',
  definition: 'Definition',
}

export const CARD_SIZE_LABELS: Readonly<Record<CardSize, string>> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
}

export const resolveOptions = (settings: {
  readonly flashcardsTrackProgress: boolean
  readonly flashcardsFront: FlashcardsFront
  readonly flashcardsCardSize: CardSize
}): FlashcardOptions => ({
  trackProgress: settings.flashcardsTrackProgress,
  front: settings.flashcardsFront,
  cardSize: settings.flashcardsCardSize,
})

/** Which text goes on which face: 'definition' simply swaps the card's own front/back. */
export const orientFaces = (
  card: { readonly front: string; readonly back: string },
  front: FlashcardsFront,
): { readonly front: string; readonly back: string } =>
  front === 'term' ? { front: card.front, back: card.back } : { front: card.back, back: card.front }

/** Screen-reader announcement after a grade. `position` is the 0-based cursor after the grade. */
export const gradeAnnouncement = (known: boolean, position: number, total: number): string => {
  const outcome = known ? 'Marked as known' : 'Marked as still learning'
  return position >= total ? `${outcome}. Session complete.` : `${outcome}. Card ${position + 1} of ${total}.`
}

export const undoAnnouncement = (position: number, total: number): string =>
  `Undid last answer. Card ${position + 1} of ${total}.`

/** What a keydown means to a flashcard: grade it, or neither. Nav left/right and 1/2 both grade. */
export const gradeForKey = (event: KeyboardEvent, keyFor: (actionId: string) => string): 'know' | 'learning' | null => {
  if (matchesBinding(keyFor('nav.right'), event) || matchesBinding(keyFor('flashcards.know'), event)) return 'know'
  if (matchesBinding(keyFor('nav.left'), event) || matchesBinding(keyFor('flashcards.dontKnow'), event))
    return 'learning'
  return null
}
