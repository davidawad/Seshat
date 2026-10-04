import type { StudyCard } from '../../types'

/**
 * Image-occlusion cards cannot be reduced to a text front/back pair:
 * `cardFrontBack` drops the image, so a text-only question ("prompt -> first
 * region label") would be unanswerable. Test mode and the Games (Match,
 * Blast, Blocks) therefore only use text-answerable cards; image cards stay
 * in Study and Flashcards.
 */
export const isImageCard = (card: StudyCard): boolean => card.content.kind === 'image-occlusion'

/** The cards a text-only mode (Test, Games) can ask about. */
export const textCards = (cards: readonly StudyCard[]): StudyCard[] => cards.filter((card) => !isImageCard(card))

export const imageCardCount = (cards: readonly StudyCard[]): number => cards.filter(isImageCard).length

/** Short user-facing note, or null when the set has no image cards. */
export const imageCardsNote = (count: number): string | null =>
  count === 0 ? null : `${count} image card${count === 1 ? ' is' : 's are'} only available in Study and Flashcards.`
