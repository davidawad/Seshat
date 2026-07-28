/**
 * Pure helpers for `ClozeContent.text` — a sentence with exactly one
 * deletion written inline as `{{answer}}` (e.g. "The mitochondria is the
 * {{powerhouse}} of the cell"). Multiple-cloze (several `{{...}}` deletions
 * per card) is out of scope for now; only the first deletion is recognized.
 */

const CLOZE_PATTERN = /\{\{([^{}]+)\}\}/

export interface ParsedCloze {
  /** Text before the deletion. */
  readonly before: string
  /** The deleted answer, trimmed. */
  readonly answer: string
  /** Text after the deletion. */
  readonly after: string
}

/**
 * Splits cloze text around its single `{{...}}` deletion. Returns `null` if
 * there is no deletion, or the deletion has no non-whitespace content.
 */
export const parseCloze = (text: string): ParsedCloze | null => {
  const match = CLOZE_PATTERN.exec(text)
  if (match === null) return null

  const answer = (match[1] ?? '').trim()
  if (answer === '') return null

  return {
    before: text.slice(0, match.index),
    answer,
    after: text.slice(match.index + match[0].length),
  }
}

/** A displayable version of the cloze text with the deletion replaced by a blank. */
export const blankedCloze = (text: string, blank = '_____'): string => {
  const parsed = parseCloze(text)
  if (parsed === null) return text
  return `${parsed.before}${blank}${parsed.after}`
}

/** Extracts the answer for the cloze's single deletion, or `null` if none is present. */
export const clozeAnswer = (text: string): string | null => parseCloze(text)?.answer ?? null
