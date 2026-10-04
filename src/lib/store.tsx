import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import { createInitialScheduling, scheduleReview } from './fsrs'
import { newCardId, newSetId } from './id'
import { type Backup, type ImportMode, type ImportReport, applyBackup, createBackup, parseBackup } from './backup'
import { loadKeybindingOverrides, saveKeybindingOverrides } from './keybindingStorage'
import { type StorageError, loadInitialState, loadState, saveState, subscribeToAppState } from './storage'
import {
  type AppState,
  type CardId,
  type ConfidenceRating,
  type ExportedCard,
  type ExportedSet,
  type Grade,
  type SetId,
  type Result,
  type Settings,
  type StudyCard,
  type StudySet,
  createEmptyAppState,
  err,
  ok,
} from '../types'

interface NewCardInput {
  readonly prompt: StudyCard['prompt']
  readonly content: StudyCard['content']
  readonly explanation: string | null
  readonly sourceRef: string | null
  readonly tags: string[]
}

interface NewSetInput {
  readonly name: string
  readonly description: string
  readonly tags: string[]
  readonly goalDate?: string | null
}

type Action =
  | { readonly type: 'hydrate'; readonly state: AppState }
  | { readonly type: 'add-set'; readonly set: StudySet }
  | { readonly type: 'update-set'; readonly id: SetId; readonly patch: Partial<NewSetInput>; readonly now: string }
  | { readonly type: 'delete-set'; readonly id: SetId }
  | { readonly type: 'add-card'; readonly card: StudyCard }
  | { readonly type: 'update-card'; readonly id: CardId; readonly patch: Partial<NewCardInput>; readonly now: string }
  | { readonly type: 'delete-card'; readonly id: CardId }
  | {
      readonly type: 'record-review'
      readonly cardId: CardId
      readonly scheduling: StudyCard['scheduling']
      readonly logEntry: AppState['reviewLog'][number]
    }
  | {
      readonly type: 'undo-review'
      readonly cardId: CardId
      readonly scheduling: StudyCard['scheduling']
      readonly reviewedAt: string
    }
  | { readonly type: 'import-set'; readonly set: StudySet; readonly cards: readonly StudyCard[] }
  | { readonly type: 'update-settings'; readonly patch: Partial<Settings> }
  | { readonly type: 'reset' }

const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'hydrate':
      return action.state
    case 'add-set':
      return { ...state, sets: [...state.sets, action.set] }
    case 'update-set':
      return {
        ...state,
        sets: state.sets.map((set) =>
          set.id === action.id ? { ...set, ...action.patch, updatedAt: action.now } : set,
        ),
      }
    case 'delete-set':
      return {
        ...state,
        sets: state.sets.filter((set) => set.id !== action.id),
        cards: state.cards.filter((card) => card.setId !== action.id),
        reviewLog: state.reviewLog.filter((entry) => entry.setId !== action.id),
      }
    case 'add-card':
      return { ...state, cards: [...state.cards, action.card] }
    case 'update-card':
      return {
        ...state,
        cards: state.cards.map((card) =>
          card.id === action.id ? { ...card, ...action.patch, updatedAt: action.now } : card,
        ),
      }
    case 'delete-card':
      return {
        ...state,
        cards: state.cards.filter((card) => card.id !== action.id),
        reviewLog: state.reviewLog.filter((entry) => entry.cardId !== action.id),
      }
    case 'record-review':
      return {
        ...state,
        cards: state.cards.map((card) =>
          card.id === action.cardId ? { ...card, scheduling: action.scheduling } : card,
        ),
        reviewLog: [...state.reviewLog, action.logEntry],
      }
    case 'undo-review':
      return {
        ...state,
        cards: state.cards.map((card) =>
          card.id === action.cardId ? { ...card, scheduling: action.scheduling } : card,
        ),
        reviewLog: state.reviewLog.filter(
          (entry) => !(entry.cardId === action.cardId && entry.reviewedAt === action.reviewedAt),
        ),
      }
    case 'import-set':
      return { ...state, sets: [...state.sets, action.set], cards: [...state.cards, ...action.cards] }
    case 'update-settings':
      return { ...state, settings: { ...state.settings, ...action.patch } }
    case 'reset':
      return createEmptyAppState()
  }
}

interface SeshatStore {
  readonly state: AppState
  readonly storageError: StorageError | null
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
  readonly importSet: (exported: ExportedSet) => StudySet
  readonly exportSet: (setId: SetId) => ExportedSet | null
  readonly updateSettings: (patch: Partial<Settings>) => void
  /** The whole app (settings, keybindings, sets, cards, review history) as one backup object. */
  readonly exportAll: () => Backup
  /** Restores a backup (a raw JSON string is parsed strictly first). Replace swaps everything; merge only adds missing sets/cards. */
  readonly importAll: (input: string | Backup, mode: ImportMode) => Result<ImportReport, string>
  readonly resetAll: () => void
}

const SeshatContext = createContext<SeshatStore | null>(null)

const toExportedCard = (card: StudyCard): ExportedCard => ({
  prompt: card.prompt,
  content: card.content,
  explanation: card.explanation,
  sourceRef: card.sourceRef,
  tags: card.tags,
})

export const SeshatProvider = ({ children }: { readonly children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState)
  const storageError = useMemo(() => {
    const result = loadState()
    return result.ok ? null : result.error
  }, [])

  useEffect(() => {
    saveState(state)
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

  const importSet = useCallback((exported: ExportedSet): StudySet => {
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
    dispatch({ type: 'import-set', set, cards })
    return set
  }, [])

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
    (input: string | Backup, mode: ImportMode): Result<ImportReport, string> => {
      const backup = typeof input === 'string' ? parseBackup(input) : ok(input)
      if (!backup.ok) return err(backup.error)
      const { state: next, report } = applyBackup(state, backup.value, mode)
      dispatch({ type: 'hydrate', state: next })
      // Keybinding overrides live outside AppState (see keybindingStorage.ts).
      if (report.keybindings !== null) saveKeybindingOverrides(report.keybindings)
      return ok(report)
    },
    [state],
  )

  const resetAll = useCallback(() => {
    dispatch({ type: 'reset' })
  }, [])

  const value = useMemo<SeshatStore>(
    () => ({
      state,
      storageError,
      addSet,
      updateSet,
      deleteSet,
      addCard,
      updateCard,
      deleteCard,
      recordReview,
      undoReview,
      importSet,
      exportSet,
      updateSettings,
      exportAll,
      importAll,
      resetAll,
    }),
    [
      state,
      storageError,
      addSet,
      updateSet,
      deleteSet,
      addCard,
      updateCard,
      deleteCard,
      recordReview,
      undoReview,
      importSet,
      exportSet,
      updateSettings,
      exportAll,
      importAll,
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
