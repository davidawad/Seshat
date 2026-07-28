import type { CardContent, StudyCard, StudySet } from '../../types'

const cardContentText = (content: CardContent): string => {
  switch (content.kind) {
    case 'short-answer':
      return [content.answer, ...content.acceptableAnswers].join(' ')
    case 'cloze':
      return content.text
    case 'mcq':
      return content.options.join(' ')
    case 'image-occlusion':
      return content.occlusions.map((region) => region.label).join(' ')
  }
}

/**
 * Client-side search predicate used by the set list: matches set name,
 * description, tags, or any of its cards' prompt/tags/content text.
 */
export const setMatchesQuery = (set: StudySet, setCards: readonly StudyCard[], query: string): boolean => {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return true

  if (set.name.toLowerCase().includes(needle)) return true
  if (set.description.toLowerCase().includes(needle)) return true
  if (set.tags.some((tag) => tag.toLowerCase().includes(needle))) return true

  return setCards.some((card) => {
    if (card.prompt.toLowerCase().includes(needle)) return true
    if (card.tags.some((tag) => tag.toLowerCase().includes(needle))) return true
    return cardContentText(card.content).toLowerCase().includes(needle)
  })
}
