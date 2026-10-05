import { type ExportedSet, type Result, err, exportedSetSchema, ok } from '../../types'
import { parseSimpleJson } from './simple-json'
import { parseTermDefinitionText } from './text-import'

/**
 * Pure parsing for the import page. A .json file is either Seshat's own
 * export (round-trips cloze/mcq/image-occlusion) or the portable
 * `[{term, definition}]` shape; pasted text is tab/comma separated lines.
 */

export const parseImportFile = (text: string, fallbackName: string): Result<ExportedSet, string> => {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return err('That file is not valid JSON.')
  }
  const rich = exportedSetSchema.safeParse(json)
  if (rich.success) return ok(rich.data)

  const simple = parseSimpleJson(text)
  if (!simple.ok) return err("That file doesn't match either JSON format Seshat understands (see the hint below).")
  const trimmed = fallbackName.trim()
  const name = simple.value.name ?? (trimmed.length > 0 ? trimmed : null)
  if (name === null) {
    return err('This file has no set name. Enter one in the name field, or use a file with a "name"/"title" field.')
  }
  return ok({ seshatExportVersion: 1, name, description: '', tags: [], cards: simple.value.cards })
}

export const parsePastedSet = (raw: string, name: string): Result<ExportedSet, string> => {
  if (name.trim().length === 0) return err('Enter a set name.')
  const parsed = parseTermDefinitionText(raw)
  if (!parsed.ok) return parsed
  return ok({ seshatExportVersion: 1, name: name.trim(), description: '', tags: [], cards: parsed.value })
}

/** How many cards the pasted text would produce (0 for empty or unparseable text). */
export const countPastedCards = (raw: string): number => {
  const parsed = parseTermDefinitionText(raw)
  return parsed.ok ? parsed.value.length : 0
}

const TEXT_EXTENSIONS = ['.csv', '.tsv', '.txt']

const hasExtension = (fileName: string, extensions: readonly string[]): boolean =>
  extensions.some((extension) => fileName.toLowerCase().endsWith(extension))

/** JSON by extension, else sniffed from the first character when the extension says nothing. */
const isJsonFile = (fileName: string, text: string): boolean =>
  hasExtension(fileName, ['.json']) || (!hasExtension(fileName, TEXT_EXTENSIONS) && /^[[{]/.test(text.trimStart()))

/** Whether an uploaded file is delimited text (.csv/.tsv/.txt) rather than JSON. */
export const isTextFile = (fileName: string, text: string): boolean => !isJsonFile(fileName, text)

/** An uploaded file: JSON goes through `parseImportFile`, delimited text through the paste parser. */
export const parseUploadedFile = (fileName: string, text: string, fallbackName: string): Result<ExportedSet, string> =>
  isJsonFile(fileName, text) ? parseImportFile(text, fallbackName) : parsePastedSet(text, fallbackName)

/** "quizlet_biology-ch3.csv" becomes "Quizlet biology ch3": a name to pre-fill, never forced. */
export const suggestSetName = (fileName: string): string => {
  const base = fileName
    .replace(/\.[^./\\]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return base.length === 0 ? '' : `${base.charAt(0).toUpperCase()}${base.slice(1)}`
}
