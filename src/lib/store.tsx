import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createInitialScheduling, scheduleReview } from './fsrs'
import { newCardId, newSetId } from './id'
import { type Backup, type ImportMode, type ImportReport, applyBackup, createBackup, parseBackup } from './backup'
import { loadKeybindingOverrides, saveKeybindingOverrides } from './keybindingStorage'
import { processImage } from './media/image-pipeline'
import { prepareCardsForImport } from './media/import-prepare'
import { useMediaStore } from './media/MediaStoreProvider'
import { type NewCardInput, type NewSetInput, reducer } from './store-reducer'
import { type StorageError, loadInitialState, loadState, saveState, subscribeToAppState } from './storage'
import {
  type AppState,
  type CardId,
  type ConfidenceRating,
  type ExportedCard,
  type ExportedSet,
  type FirstSetSource,
  type Grade,
  type SetId,
  type Result,
  type Settings,
  type StudyCard,
  type StudySet,
  err,
  ok,
} from '../types'

interface SeshatStore {
  readonly state: AppState
  readonly storageError: StorageError | null
  /** The last failed save (quota full, storage blocked); null once a later save succeeds. */
  readonly saveError: StorageError | null
  readonly addSet: (input: NewSetInput) => StudySet
  readonly updateSet: (id: SetId, patch: Partial<NewSetInput>) => void
  readonly deleteSet: (id: SetId) => void
  readonly addCard: (setId: SetId, input: NewCardInput) => StudyCard
  readonly updateCard: (id: CardId, patch: Partial<NewCardInput>) => void
  readonly deleteCard: (id: CardId) => void
  readonly recordReview: (
    cardId: CardId,
    grade: Grade,
    confidence: ConfidenceRating | null,
    correct: boolean,
    elapsedMs: number,
    selfExplanation?: string | null,
  ) => string | null
  /** Reverses one `recordReview`: restores the card's earlier scheduling and drops the log entry stamped `reviewedAt`. */
  readonly undoReview: (cardId: CardId, previousScheduling: StudyCard['scheduling'], reviewedAt: string) => void
  /** Adds an exported set as a new one; `source` ('import' by default) is recorded for the local first-week stats. */
  readonly importSet: (exported: ExportedSet, source?: FirstSetSource) => StudySet
  /** Notes (locally only) that a full backup was just downloaded, restarting the backup-reminder schedule. */
  readonly recordBackupDownloaded: () => void
  /** Hides the backup reminder until the next 30 days / 50 reviews. */
  readonly dismissBackupNudge: () => void
  /**
   * Async step BEFORE `importSet` for a set that came from a file/URL: stores the export's embedded `media`, converts
   * v1-era inline data URLs into stored images, and returns the export ready for `importSet`.
   */
  readonly prepareSetImport: (exported: ExportedSet) => Promise<Result<ExportedSet, string>>
  readonly exportSet: (setId: SetId) => ExportedSet | null
  readonly updateSettings: (patch: Partial<Settings>) => void
  /** The whole app (settings, keybindings, sets, cards, review history) as one backup object. */
  readonly exportAll: () => Backup
  /**
   * Restores a backup (a raw JSON string is parsed strictly first). Replace swaps everything; merge only adds missing
   * sets/cards. Async because the backup's images are stored (and verified) BEFORE any state changes.
   */
  readonly importAll: (input: string | Backup, mode: ImportMode) => Promise<Result<ImportReport, string>>
  /** Swaps the whole in-memory state (used by "Restore previous version", which has already persisted it). */
  readonly replaceState: (state: AppState) => void
  readonly resetAll: () => void
}

const SeshatContext = createContext<SeshatStore | null>(null)

const toExportedCard = (card: StudyCard): ExportedCard => ({
  prompt: card.prompt,
  promptImage: card.promptImage,
  content: card.content,
  explanation: card.explanation,
  sourceRef: card.sourceRef,
  tags: card.tags,
})

export const SeshatProvider = ({ children }: { readonly children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState)
  const media = useMediaStore()
  const ingestDeps = useMemo(() => ({ store: media, process: (blob: Blob) => processImage(blob) }), [media])
  // Imports await image I/O before dispatching, so they must apply to the state as it is AFTER that wait.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })
  const storageError = useMemo(() => {
    const result = loadState()
    return result.ok ? null : result.error
  }, [])

  const [saveError, setSaveError] = useState<StorageError | null>(null)

  useEffect(() => {
    const result = saveState(state)
    setSaveError(result.ok ? null : result.error)
  }, [state])

  // Other tabs (and window.seshat) write straight to storage; pull their
  // changes into React state. Our own saves fire no event here, and a
  // hydrate that echoes back identical bytes is a no-op write, so this
  // cannot loop.
  useEffect(() => subscribeToAppState((next) => dispatch({ type: 'hydrate', state: next })), [])

  const addSet = useCallback((input: NewSetInput): StudySet => {
    const now = new Date().toISOString()
    const set: StudySet = { id: newSetId(), createdAt: now, updatedAt: now, ...input, goalDate: input.goalDate ?? null }
    dispatch({ type: 'add-set', set })
    return set
  }, [])

  const updateSet = useCallback((id: SetId, patch: Partial<NewSetInput>) => {
    dispatch({ type: 'update-set', id, patch, now: new Date().toISOString() })
  }, [])

  const deleteSet = useCallback((id: SetId) => {
    dispatch({ type: 'delete-set', id })
  }, [])

  const addCard = useCallback((setId: SetId, input: NewCardInput): StudyCard => {
    const now = new Date().toISOString()
    const card: StudyCard = {
      id: newCardId(),
      setId,
      createdAt: now,
      updatedAt: now,
      scheduling: createInitialScheduling(new Date()),
      promptImage: null,
      ...input,
    }
    dispatch({ type: 'add-card', card })
    return card
  }, [])

  const updateCard = useCallback((id: CardId, patch: Partial<NewCardInput>) => {
    dispatch({ type: 'update-card', id, patch, now: new Date().toISOString() })
  }, [])

  const deleteCard = useCallback((id: CardId) => {
    dispatch({ type: 'delete-card', id })
  }, [])

  const recordReview = useCallback(
    (
      cardId: CardId,
      grade: Grade,
      confidence: ConfidenceRating | null,
      correct: boolean,
      elapsedMs: number,
      selfExplanation: string | null = null,
    ) => {
      const card = state.cards.find((candidate) => candidate.id === cardId)
      if (card === undefined) return null
      const set = state.sets.find((candidate) => candidate.id === card.setId)
      const goalDate = set?.goalDate == null ? null : new Date(set.goalDate)
      const now = new Date()
      const { scheduling, retrievabilityAtReview } = scheduleReview(
        card.scheduling,
        grade,
        state.settings.desiredRetention,
        now,
        goalDate,
      )
      dispatch({
        type: 'record-review',
        cardId,
        scheduling,
        logEntry: {
          cardId,
          setId: card.setId,
          reviewedAt: now.toISOString(),
          grade,
          confidence,
          correct,
          retrievabilityAtReview,
          elapsedMs,
          selfExplanation,
        },
      })
      return now.toISOString()
    },
    [state.cards, state.sets, state.settings.desiredRetention],
  )

  const undoReview = useCallback((cardId: CardId, previousScheduling: StudyCard['scheduling'], reviewedAt: string) => {
    dispatch({ type: 'undo-review', cardId, scheduling: previousScheduling, reviewedAt })
  }, [])

  const importSet = useCallback((exported: ExportedSet, source: FirstSetSource = 'import'): StudySet => {
    const now = new Date().toISOString()
    const set: StudySet = {
      id: newSetId(),
      name: exported.name,
      description: exported.description,
      tags: exported.tags,
      createdAt: now,
      updatedAt: now,
      goalDate: null,
    }
    const cards: StudyCard[] = exported.cards.map((exportedCard) => ({
      id: newCardId(),
      setId: set.id,
      createdAt: now,
      updatedAt: now,
      scheduling: createInitialScheduling(new Date()),
      ...exportedCard,
    }))
    dispatch({ type: 'import-set', set, cards, source })
    return set
  }, [])

  const recordBackupDownloaded = useCallback(() => {
    dispatch({ type: 'backup-downloaded', at: new Date().toISOString() })
  }, [])

  const dismissBackupNudge = useCallback(() => {
    dispatch({ type: 'backup-nudge-dismissed', at: new Date().toISOString() })
  }, [])

  const prepareSetImport = useCallback(
    async (exported: ExportedSet): Promise<Result<ExportedSet, string>> => {
      const prepared = await prepareCardsForImport(exported.cards, exported.media, ingestDeps)
      if (!prepared.ok) return err(prepared.error)
      const { media: _embedded, ...rest } = exported
      return ok({ ...rest, cards: prepared.value.cards })
    },
    [ingestDeps],
  )

  const exportSet = useCallback(
    (setId: SetId): ExportedSet | null => {
      const set = state.sets.find((candidate) => candidate.id === setId)
      if (set === undefined) return null
      return {
        seshatExportVersion: 1,
        name: set.name,
        description: set.description,
        tags: set.tags,
        cards: state.cards.filter((card) => card.setId === setId).map(toExportedCard),
      }
    },
    [state.sets, state.cards],
  )

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    dispatch({ type: 'update-settings', patch })
  }, [])

  const exportAll = useCallback((): Backup => createBackup(state, loadKeybindingOverrides(), new Date()), [state])

  const importAll = useCallback(
    async (input: string | Backup, mode: ImportMode): Promise<Result<ImportReport, string>> => {
      const backup = typeof input === 'string' ? parseBackup(input) : ok(input)
      if (!backup.ok) return err(backup.error)
      const prepared = await prepareCardsForImport(backup.value.cards, backup.value.media, ingestDeps)
      if (!prepared.ok) return err(prepared.error)
      const { state: next, report } = applyBackup(
        stateRef.current,
        { ...backup.value, cards: prepared.value.cards, media: {} },
        mode,
      )
      dispatch({ type: 'hydrate', state: next })
      // Keybinding overrides live outside AppState (see keybindingStorage.ts).
      if (report.keybindings !== null) saveKeybindingOverrides(report.keybindings)
      return ok({ ...report, imagesMissing: prepared.value.missing, imagesNotConverted: prepared.value.notConverted })
    },
    [ingestDeps],
  )

  const replaceState = useCallback((next: AppState) => {
    dispatch({ type: 'hydrate', state: next })
  }, [])

  const resetAll = useCallback(() => {
    dispatch({ type: 'reset' })
  }, [])

  const value = useMemo<SeshatStore>(
    () => ({
      state,
      storageError,
      saveError,
      addSet,
      updateSet,
      deleteSet,
      addCard,
      updateCard,
      deleteCard,
      recordReview,
      undoReview,
      importSet,
      recordBackupDownloaded,
      dismissBackupNudge,
      prepareSetImport,
      exportSet,
      updateSettings,
      exportAll,
      importAll,
      replaceState,
      resetAll,
    }),
    [
      state,
      storageError,
      saveError,
      addSet,
      updateSet,
      deleteSet,
      addCard,
      updateCard,
      deleteCard,
      recordReview,
      undoReview,
      importSet,
      recordBackupDownloaded,
      dismissBackupNudge,
      prepareSetImport,
      exportSet,
      updateSettings,
      exportAll,
      importAll,
      replaceState,
      resetAll,
    ],
  )

  return <SeshatContext.Provider value={value}>{children}</SeshatContext.Provider>
}

export const useSeshatStore = (): SeshatStore => {
  const context = useContext(SeshatContext)
  if (context === null) throw new Error('useSeshatStore must be used within a SeshatProvider')
  return context
}
