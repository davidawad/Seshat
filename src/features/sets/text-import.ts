import { type ExportedCard, type Result, err, ok } from '../../types'

const QUOTED_FIRST = /^"((?:[^"]|"")*)"[\t,]\s*(.*)$/
const WRAPPED = /^"((?:[^"]|"")*)"$/
const HEADER_TERMS = new Set(['term', 'front', 'question'])
const HEADER_DEFINITIONS = new Set(['definition', 'back', 'answer'])

const unquote = (field: string): string => {
  const wrapped = WRAPPED.exec(field)
  return wrapped === null ? field : (wrapped[1] ?? '').replaceAll('""', '"')
}

/** One line into `[term, definition]`: tab if the line has one, else comma; a CSV-quoted first field may hold commas. */
const splitLine = (line: string): readonly [string, string] | null => {
  const quoted = QUOTED_FIRST.exec(line)
  if (quoted !== null) return [(quoted[1] ?? '').replaceAll('""', '"').trim(), unquote((quoted[2] ?? '').trim()).trim()]
  const delimiter = line.includes('\t') ? '\t' : ','
  const index = line.indexOf(delimiter)
  if (index === -1) return null
  return [unquote(line.slice(0, index).trim()).trim(), unquote(line.slice(index + 1).trim()).trim()]
}

const isHeaderRow = ([term, definition]: readonly [string, string]): boolean =>
  HEADER_TERMS.has(term.toLowerCase()) && HEADER_DEFINITIONS.has(definition.toLowerCase())

/**
 * Parses Quizlet-style "term<TAB>definition" pasted text into short-answer
 * `ExportedCard`s (one per line). Falls back to a comma delimiter for lines
 * with no tab, so Quizlet text exports and simple .csv/.tsv/.txt files all work. A CSV-quoted
 * term may contain commas, and a leading "term,definition" header row is dropped (when more rows follow). Blank
 * lines are skipped. Quoted cells that span several lines are not supported. Pure — no I/O, fully unit-tested.
 */
export const parseTermDefinitionText = (raw: string): Result<ExportedCard[], string> => {
  if (raw.trim().length === 0) {
    return err('Paste some term/definition lines first — there is nothing to import.')
  }

  const pairs = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(splitLine)
    .filter((pair): pair is readonly [string, string] => pair !== null)
  const cards: ExportedCard[] = pairs
    .filter(
      ([term, definition], index) =>
        term.length > 0 &&
        definition.length > 0 &&
        !(index === 0 && pairs.length > 1 && isHeaderRow([term, definition])),
    )
    .map(([term, definition]) => ({
      prompt: term,
      promptImage: null,
      content: { kind: 'short-answer', answer: definition, acceptableAnswers: [], answerImage: null },
      explanation: null,
      sourceRef: null,
      tags: [],
    }))

  if (cards.length === 0) {
    return err(
      'No lines could be parsed. Each line needs a term and a definition separated by a tab (or a comma if there is no tab).',
    )
  }

  return ok(cards)
}
