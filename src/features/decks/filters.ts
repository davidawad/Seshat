import type { CardContent, Deck, StudyCard } from '../../types'

const cardContentText = (content: CardContent): string => {
  switch (content.kind) {
    case 'short-answer':
      return [content.answer, ...content.acceptableAnswers].join(' ')
    case 'cloze':
      return content.text
    case 'mcq':
      return content.options.join(' ')
  }
}

/**
 * Client-side search predicate used by the deck list: matches deck name,
 * description, tags, or any of its cards' prompt/tags/content text.
 */
export const deckMatchesQuery = (deck: Deck, deckCards: readonly StudyCard[], query: string): boolean => {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return true

  if (deck.name.toLowerCase().includes(needle)) return true
  if (deck.description.toLowerCase().includes(needle)) return true
  if (deck.tags.some((tag) => tag.toLowerCase().includes(needle))) return true

  return deckCards.some((card) => {
    if (card.prompt.toLowerCase().includes(needle)) return true
    if (card.tags.some((tag) => tag.toLowerCase().includes(needle))) return true
    return cardContentText(card.content).toLowerCase().includes(needle)
  })
}
