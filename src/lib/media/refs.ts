import type { CardContent } from '../../types'
import type { MediaRef } from './types'

/** The slice of a card (StudyCard or ExportedCard) that can point at stored images. */
export interface MediaCard {
  readonly promptImage: MediaRef | null
  readonly content: CardContent
}

/**
 * Every MediaRef a card holds (prompt image, short-answer answer image,
 * image-occlusion image). New reference sites (diagram pins, ...) MUST be
 * added here: it is the one place that decides which blobs are "in use", for
 * garbage collection and for what a backup/export has to carry.
 */
export const cardMediaRefs = (card: MediaCard): readonly MediaRef[] => {
  const { content } = card
  return [
    ...(card.promptImage ? [card.promptImage] : []),
    ...(content.kind === 'image-occlusion' && content.image ? [content.image] : []),
    ...(content.kind === 'short-answer' && content.answerImage ? [content.answerImage] : []),
  ]
}

/** One ref per distinct media id across `cards` (the first seen wins; alt text is not part of the blob). */
export const collectMediaRefs = (cards: readonly MediaCard[]): ReadonlyMap<string, MediaRef> => {
  const refs = new Map<string, MediaRef>()
  for (const card of cards) for (const ref of cardMediaRefs(card)) if (!refs.has(ref.id)) refs.set(ref.id, ref)
  return refs
}

/** What an agent sees of a stored image: identity, alt text and size — never bytes. */
export const mediaSummary = (media: MediaRef | null | undefined) =>
  !media ? null : { id: media.id, alt: media.alt, width: media.width, height: media.height }
