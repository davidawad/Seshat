import { z } from 'zod'
import { type ExportedCard, type ExportedSet, type Result, err, ok } from '../../types'
import { parseTagsInput } from './tags'

/**
 * The create-set editor's in-progress state, and everything pure about it:
 * the localStorage draft (parsed defensively with Zod), and the conversion
 * from editable rows to an `ExportedSet` (empty rows ignored, half-filled
 * rows reported). No React in here, so it is unit-tested directly.
 */

export const DRAFT_STORAGE_KEY = 'seshat:set-draft:v1'

export interface DraftRow {
  readonly id: string
  readonly term: string
  readonly definition: string
}

export interface SetDraft {
  readonly title: string
  readonly description: string
  /** Raw comma-separated text exactly as typed; parsed with `parseTagsInput`. */
  readonly tags: string
  readonly rows: readonly DraftRow[]
}

const draftSchema = z.object({
  title: z.string(),
  description: z.string(),
  tags: z.string(),
  rows: z.array(z.object({ id: z.string().min(1), term: z.string(), definition: z.string() })).min(1),
})

export const newRowId = (): string => crypto.randomUUID()
export const newRow = (): DraftRow => ({ id: newRowId(), term: '', definition: '' })

export const INITIAL_ROW_COUNT = 2

export const emptyDraft = (): SetDraft => ({
  title: '',
  description: '',
  tags: '',
  rows: Array.from({ length: INITIAL_ROW_COUNT }, newRow),
})

const isBlank = (text: string): boolean => text.trim().length === 0

/** True when nothing worth saving has been typed (so there is no draft to keep or restore). */
export const isDraftEmpty = (draft: SetDraft): boolean =>
  isBlank(draft.title) &&
  isBlank(draft.description) &&
  isBlank(draft.tags) &&
  draft.rows.every((row) => isBlank(row.term) && isBlank(row.definition))

export const serializeDraft = (draft: SetDraft): string => JSON.stringify(draft)

/** Anything unreadable (null, bad JSON, wrong shape, hand-edited) is "no draft", never an exception. */
export const parseDraft = (raw: string | null): SetDraft | null => {
  if (raw === null) return null
  try {
    const parsed = draftSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    const seen = new Set<string>()
    // Hand-edited duplicate row ids would break React keys; regenerate repeats.
    const rows = parsed.data.rows.map((row) => {
      const id = seen.has(row.id) ? newRowId() : row.id
      seen.add(id)
      return { ...row, id }
    })
    return { ...parsed.data, rows }
  } catch {
    return null
  }
}

export const loadDraft = (storage: Pick<Storage, 'getItem'> = window.localStorage): SetDraft | null => {
  try {
    return parseDraft(storage.getItem(DRAFT_STORAGE_KEY))
  } catch {
    return null
  }
}

/** Saves a non-empty draft, removes the key for an empty one. Returns whether the write succeeded. */
export const saveDraft = (
  draft: SetDraft,
  storage: Pick<Storage, 'setItem' | 'removeItem'> = window.localStorage,
): boolean => {
  try {
    if (isDraftEmpty(draft)) storage.removeItem(DRAFT_STORAGE_KEY)
    else storage.setItem(DRAFT_STORAGE_KEY, serializeDraft(draft))
    return true
  } catch {
    return false
  }
}

export const clearDraft = (storage: Pick<Storage, 'removeItem'> = window.localStorage): void => {
  try {
    storage.removeItem(DRAFT_STORAGE_KEY)
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

export interface DraftProblems {
  readonly titleMissing: boolean
  /** 1-based numbers of rows with exactly one side filled. */
  readonly incompleteRows: readonly number[]
  readonly noCards: boolean
}

const toExportedCard = (term: string, definition: string): ExportedCard => ({
  prompt: term.trim(),
  content: { kind: 'short-answer', answer: definition.trim(), acceptableAnswers: [] },
  explanation: null,
  sourceRef: null,
  tags: [],
})

/** Rows -> cards. Both-blank rows are skipped; one-sided rows are returned as problems. */
export const rowsToCards = (
  rows: readonly DraftRow[],
): { readonly cards: readonly ExportedCard[]; readonly incompleteRows: readonly number[] } => ({
  cards: rows
    .filter((row) => !isBlank(row.term) && !isBlank(row.definition))
    .map((row) => toExportedCard(row.term, row.definition)),
  incompleteRows: rows.flatMap((row, index) => (isBlank(row.term) !== isBlank(row.definition) ? [index + 1] : [])),
})

export const draftToExportedSet = (draft: SetDraft): Result<ExportedSet, DraftProblems> => {
  const { cards, incompleteRows } = rowsToCards(draft.rows)
  const titleMissing = isBlank(draft.title)
  const noCards = cards.length === 0 && incompleteRows.length === 0
  if (titleMissing || incompleteRows.length > 0 || noCards) return err({ titleMissing, incompleteRows, noCards })
  return ok({
    seshatExportVersion: 1,
    name: draft.title.trim(),
    description: draft.description.trim(),
    tags: parseTagsInput(draft.tags),
    cards: [...cards],
  })
}
