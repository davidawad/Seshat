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
