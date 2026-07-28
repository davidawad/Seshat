/**
 * Shared helper for the plain-text "tags" inputs used by the deck and card
 * forms: a comma-separated string in, a deduplicated, trimmed tag list out.
 */
export const parseTagsInput = (raw: string): string[] => {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const part of raw.split(',')) {
    const tag = part.trim()
    if (tag.length === 0) continue
    if (seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
  }
  return tags
}
