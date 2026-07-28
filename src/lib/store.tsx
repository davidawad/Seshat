import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import { createInitialScheduling, scheduleReview } from './fsrs'
import { newCardId, newDeckId } from './id'
import { type StorageError, loadState, saveState } from './storage'
import {
  type AppState,
  type CardId,
  type ConfidenceRating,
  type Deck,
  type DeckId,
  type ExportedCard,
  type ExportedDeck,
  type Grade,
  type Settings,
  type StudyCard,
  createEmptyAppState,
} from '../types'

interface NewCardInput {
  readonly prompt: StudyCard['prompt']
  readonly content: StudyCard['content']
  readonly explanation: string | null
  readonly sourceRef: string | null
  readonly tags: string[]
}

interface NewDeckInput {
  readonly name: string
  readonly description: string
  readonly tags: string[]
  readonly goalDate?: string | null
}

type Action =
  | { readonly type: 'hydrate'; readonly state: AppState }
  | { readonly type: 'add-deck'; readonly deck: Deck }
  | { readonly type: 'update-deck'; readonly id: DeckId; readonly patch: Partial<NewDeckInput>; readonly now: string }
  | { readonly type: 'delete-deck'; readonly id: DeckId }
  | { readonly type: 'add-card'; readonly card: StudyCard }
  | { readonly type: 'update-card'; readonly id: CardId; readonly patch: Partial<NewCardInput>; readonly now: string }
  | { readonly type: 'delete-card'; readonly id: CardId }
  | {
      readonly type: 'record-review'
      readonly cardId: CardId
      readonly scheduling: StudyCard['scheduling']
      readonly logEntry: AppState['reviewLog'][number]
    }
  | { readonly type: 'import-deck'; readonly deck: Deck; readonly cards: readonly StudyCard[] }
  | { readonly type: 'update-settings'; readonly patch: Partial<Settings> }
  | { readonly type: 'reset' }

const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'hydrate':
      return action.state
    case 'add-deck':
      return { ...state, decks: [...state.decks, action.deck] }
    case 'update-deck':
      return {
        ...state,
        decks: state.decks.map((deck) =>
          deck.id === action.id ? { ...deck, ...action.patch, updatedAt: action.now } : deck,
        ),
      }
    case 'delete-deck':
      return {
        ...state,
        decks: state.decks.filter((deck) => deck.id !== action.id),
        cards: state.cards.filter((card) => card.deckId !== action.id),
        reviewLog: state.reviewLog.filter((entry) => entry.deckId !== action.id),
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
    case 'import-deck':
      return { ...state, decks: [...state.decks, action.deck], cards: [...state.cards, ...action.cards] }
    case 'update-settings':
      return { ...state, settings: { ...state.settings, ...action.patch } }
    case 'reset':
      return createEmptyAppState()
  }
}

interface SeshatStore {
  readonly state: AppState
  readonly storageError: StorageError | null
  readonly addDeck: (input: NewDeckInput) => Deck
  readonly updateDeck: (id: DeckId, patch: Partial<NewDeckInput>) => void
  readonly deleteDeck: (id: DeckId) => void
  readonly addCard: (deckId: DeckId, input: NewCardInput) => StudyCard
  readonly updateCard: (id: CardId, patch: Partial<NewCardInput>) => void
  readonly deleteCard: (id: CardId) => void
  readonly recordReview: (
    cardId: CardId,
    grade: Grade,
    confidence: ConfidenceRating | null,
    correct: boolean,
    elapsedMs: number,
  ) => void
  readonly importDeck: (exported: ExportedDeck) => Deck
  readonly exportDeck: (deckId: DeckId) => ExportedDeck | null
  readonly updateSettings: (patch: Partial<Settings>) => void
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
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const result = loadState()
    return result.ok ? result.value : createEmptyAppState()
  })
  const storageError = useMemo(() => {
    const result = loadState()
    return result.ok ? null : result.error
  }, [])

  useEffect(() => {
    saveState(state)
  }, [state])

  const addDeck = useCallback((input: NewDeckInput): Deck => {
    const now = new Date().toISOString()
    const deck: Deck = { id: newDeckId(), createdAt: now, updatedAt: now, ...input, goalDate: input.goalDate ?? null }
    dispatch({ type: 'add-deck', deck })
    return deck
  }, [])

  const updateDeck = useCallback((id: DeckId, patch: Partial<NewDeckInput>) => {
    dispatch({ type: 'update-deck', id, patch, now: new Date().toISOString() })
  }, [])

  const deleteDeck = useCallback((id: DeckId) => {
    dispatch({ type: 'delete-deck', id })
  }, [])

  const addCard = useCallback((deckId: DeckId, input: NewCardInput): StudyCard => {
    const now = new Date().toISOString()
    const card: StudyCard = {
      id: newCardId(),
      deckId,
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
    (cardId: CardId, grade: Grade, confidence: ConfidenceRating | null, correct: boolean, elapsedMs: number) => {
      const card = state.cards.find((candidate) => candidate.id === cardId)
      if (card === undefined) return
      const deck = state.decks.find((candidate) => candidate.id === card.deckId)
      const goalDate = deck?.goalDate == null ? null : new Date(deck.goalDate)
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
          deckId: card.deckId,
          reviewedAt: now.toISOString(),
          grade,
          confidence,
          correct,
          retrievabilityAtReview,
          elapsedMs,
        },
      })
    },
    [state.cards, state.decks, state.settings.desiredRetention],
  )

  const importDeck = useCallback((exported: ExportedDeck): Deck => {
    const now = new Date().toISOString()
    const deck: Deck = {
      id: newDeckId(),
      name: exported.name,
      description: exported.description,
      tags: exported.tags,
      createdAt: now,
      updatedAt: now,
      goalDate: null,
    }
    const cards: StudyCard[] = exported.cards.map((exportedCard) => ({
      id: newCardId(),
      deckId: deck.id,
      createdAt: now,
      updatedAt: now,
      scheduling: createInitialScheduling(new Date()),
      ...exportedCard,
    }))
    dispatch({ type: 'import-deck', deck, cards })
    return deck
  }, [])

  const exportDeck = useCallback(
    (deckId: DeckId): ExportedDeck | null => {
      const deck = state.decks.find((candidate) => candidate.id === deckId)
      if (deck === undefined) return null
      return {
        seshatExportVersion: 1,
        name: deck.name,
        description: deck.description,
        tags: deck.tags,
        cards: state.cards.filter((card) => card.deckId === deckId).map(toExportedCard),
      }
    },
    [state.decks, state.cards],
  )

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    dispatch({ type: 'update-settings', patch })
  }, [])

  const resetAll = useCallback(() => {
    dispatch({ type: 'reset' })
  }, [])

  const value = useMemo<SeshatStore>(
    () => ({
      state,
      storageError,
      addDeck,
      updateDeck,
      deleteDeck,
      addCard,
      updateCard,
      deleteCard,
      recordReview,
      importDeck,
      exportDeck,
      updateSettings,
      resetAll,
    }),
    [
      state,
      storageError,
      addDeck,
      updateDeck,
      deleteDeck,
      addCard,
      updateCard,
      deleteCard,
      recordReview,
      importDeck,
      exportDeck,
      updateSettings,
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
