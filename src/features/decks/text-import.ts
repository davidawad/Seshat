import { type ExportedCard, type Result, err, ok } from '../../types'

/**
 * Parses Quizlet-style "term<TAB>definition" pasted text into short-answer
 * `ExportedCard`s (one per line). Falls back to a comma delimiter for lines
 * with no tab. Blank lines are skipped. Pure — no I/O, fully unit-tested.
 */
export const parseTermDefinitionText = (raw: string): Result<ExportedCard[], string> => {
  if (raw.trim().length === 0) {
    return err('Paste some term/definition lines first — there is nothing to import.')
  }

  const cards: ExportedCard[] = []

  for (const line of raw.split(/\r?\n/)) {
    const trimmedLine = line.trim()
    if (trimmedLine.length === 0) continue

    const delimiter = trimmedLine.includes('\t') ? '\t' : ','
    const delimiterIndex = trimmedLine.indexOf(delimiter)
    if (delimiterIndex === -1) continue

    const term = trimmedLine.slice(0, delimiterIndex).trim()
    const definition = trimmedLine.slice(delimiterIndex + 1).trim()
    if (term.length === 0 || definition.length === 0) continue

    cards.push({
      prompt: term,
      content: { kind: 'short-answer', answer: definition, acceptableAnswers: [] },
      explanation: null,
      sourceRef: null,
      tags: [],
    })
  }

  if (cards.length === 0) {
    return err(
      'No lines could be parsed. Each line needs a term and a definition separated by a tab (or a comma if there is no tab).',
    )
  }

  return ok(cards)
}
