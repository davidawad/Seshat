import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type DraftRowPatch,
  type SetDraft,
  clearDraft,
  emptyDraft,
  isDraftEmpty,
  loadDraft,
  newRow,
  saveDraft,
} from './set-draft'

export interface SetDraftApi {
  readonly draft: SetDraft
  /** True once a draft was read back from storage on mount. */
  readonly restored: boolean
  /** True while the stored copy matches what is on screen and is not empty. */
  readonly saved: boolean
  readonly setField: (field: 'title' | 'description' | 'tags', value: string) => void
  readonly setRow: (id: string, patch: DraftRowPatch) => void
  /** Appends a blank row and returns its id. */
  readonly addRow: () => string
  /** Removes a row, but never the last one. */
  readonly deleteRow: (id: string) => void
  /** Drops the stored draft and stops persisting (call right before leaving after a successful create). */
  readonly discard: () => void
}

/**
 * The create editor's state, mirrored to localStorage on every change so a
 * reload or an accidental navigation never loses work. Restores on mount.
 */
export const useSetDraft = (): SetDraftApi => {
  const [initial] = useState(() => loadDraft())
  const [draft, setDraft] = useState<SetDraft>(() => initial ?? emptyDraft())
  const [saved, setSaved] = useState(false)
  const discarded = useRef(false)

  useEffect(() => {
    if (discarded.current) return
    setSaved(!isDraftEmpty(draft) && saveDraft(draft))
  }, [draft])

  const setField = useCallback((field: 'title' | 'description' | 'tags', value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }, [])

  const setRow = useCallback((id: string, patch: DraftRowPatch) => {
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    }))
  }, [])

  const addRow = useCallback((): string => {
    const row = newRow()
    setDraft((current) => ({ ...current, rows: [...current.rows, row] }))
    return row.id
  }, [])

  const deleteRow = useCallback((id: string) => {
    setDraft((current) =>
      current.rows.length <= 1 ? current : { ...current, rows: current.rows.filter((row) => row.id !== id) },
    )
  }, [])

  const discard = useCallback(() => {
    discarded.current = true
    clearDraft()
  }, [])

  return { draft, restored: initial !== null, saved, setField, setRow, addRow, deleteRow, discard }
}
