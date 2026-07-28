/**
 * A zero-backend JS API exposed on `window.seshat` — for bookmarklets,
 * browser-console scripting, userscripts, or any other same-page script
 * that wants to read or write Seshat's data. This is the "browser-only
 * API, no backend" version of programmatic access: there is no server to
 * expose an HTTP/MCP endpoint from (a browser tab cannot accept incoming
 * connections), so this API works directly against `localStorage`
 * instead, through the same `loadState`/`saveState` the app itself uses.
 *
 * Caveat, and it's a real one: if the Seshat tab is open and mounted
 * while a script calls this API, the React app's in-memory state won't
 * pick up the change until the page reloads (React only reads
 * localStorage once, on mount). This API is for scripting Seshat's data
 * from outside the app, not for live two-way sync with an open tab.
 */
import { newCardId, newDeckId } from './id'
import { loadState, saveState } from './storage'
import {
  type Deck,
  type ExportedDeck,
  type Result,
  type StudyCard,
  createEmptyAppState,
  err,
  exportedDeckSchema,
  ok,
} from '../types'
import { createInitialScheduling } from './fsrs'
import { cardFrontBack } from '../features/study/card-summary'
import { parseSimpleJson, toSimpleJson } from '../features/decks/simple-json'

export interface DeckSummary {
  readonly id: string
  readonly name: string
  readonly cardCount: number
}

const currentState = () => {
  const result = loadState()
  return result.ok ? result.value : createEmptyAppState()
}

/** Every deck currently stored, with its card count. */
const listDecks = (): readonly DeckSummary[] => {
  const state = currentState()
  return state.decks.map((deck) => ({
    id: deck.id,
    name: deck.name,
    cardCount: state.cards.filter((card) => card.deckId === deck.id).length,
  }))
}

export interface CardSummary {
  readonly id: string
  readonly front: string
  readonly back: string
}

/** Every card in a deck, reduced to {id, front, back} regardless of content kind. */
const listCards = (deckId: string): readonly CardSummary[] => {
  const state = currentState()
  return state.cards.filter((card) => card.deckId === deckId).map((card) => ({ id: card.id, ...cardFrontBack(card) }))
}

/** The full Seshat deck-export JSON for one deck, or `null` if it doesn't exist. */
const exportDeck = (deckId: string): ExportedDeck | null => {
  const state = currentState()
  const deck = state.decks.find((candidate) => candidate.id === deckId)
  if (deck === undefined) return null
  const cards = state.cards.filter((card) => card.deckId === deckId)
  return {
    seshatExportVersion: 1,
    name: deck.name,
    description: deck.description,
    tags: deck.tags,
    cards: cards.map((card) => ({
      prompt: card.prompt,
      content: card.content,
      explanation: card.explanation,
      sourceRef: card.sourceRef,
      tags: card.tags,
    })),
  }
}

/** The portable term/definition JSON for one deck, or `null` if it doesn't exist. */
const exportDeckSimple = (
  deckId: string,
): {
  readonly name: string
  readonly terms: readonly { readonly term: string; readonly definition: string }[]
} | null => {
  const state = currentState()
  const deck = state.decks.find((candidate) => candidate.id === deckId)
  if (deck === undefined) return null
  const cards = state.cards.filter((card) => card.deckId === deckId)
  return toSimpleJson(deck.name, cards)
}

const insertDeck = (exported: ExportedDeck): Deck => {
  const state = currentState()
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
  saveState({ ...state, decks: [...state.decks, deck], cards: [...state.cards, ...cards] })
  return deck
}

/** Imports a full Seshat deck-export object (already parsed JSON, not a string). */
const importDeck = (json: unknown): Result<DeckSummary, string> => {
  const parsed = exportedDeckSchema.safeParse(json)
  if (!parsed.success) return err(parsed.error.issues.map((issue) => issue.message).join('; '))
  const deck = insertDeck(parsed.data)
  return ok({ id: deck.id, name: deck.name, cardCount: parsed.data.cards.length })
}

/** Imports a term/definition JSON string (bare array or {name/title, terms}). `deckName` is used only if the file has none. */
const importSimpleJson = (raw: string, deckName?: string): Result<DeckSummary, string> => {
  const parsed = parseSimpleJson(raw)
  if (!parsed.ok) return err(parsed.error)
  const name = parsed.value.name ?? deckName
  if (name === undefined || name.trim() === '')
    return err('This file has no deck name — pass one as the second argument.')
  const deck = insertDeck({ seshatExportVersion: 1, name, description: '', tags: [], cards: parsed.value.cards })
  return ok({ id: deck.id, name: deck.name, cardCount: parsed.value.cards.length })
}

export interface SeshatWindowApi {
  readonly listDecks: typeof listDecks
  readonly listCards: typeof listCards
  readonly exportDeck: typeof exportDeck
  readonly exportDeckSimple: typeof exportDeckSimple
  readonly importDeck: typeof importDeck
  readonly importSimpleJson: typeof importSimpleJson
  readonly cardFrontBack: typeof cardFrontBack
}

export const seshatWindowApi: SeshatWindowApi = {
  listDecks,
  listCards,
  exportDeck,
  exportDeckSimple,
  importDeck,
  importSimpleJson,
  cardFrontBack,
}

declare global {
  interface Window {
    seshat: SeshatWindowApi
  }
}
