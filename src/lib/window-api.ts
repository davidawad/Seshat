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
import { newCardId, newSetId } from './id'
import { loadState, saveState } from './storage'
import {
  type ExportedSet,
  type Result,
  type StudyCard,
  type StudySet,
  createEmptyAppState,
  err,
  exportedSetSchema,
  ok,
} from '../types'
import { createInitialScheduling } from './fsrs'
import { cardFrontBack } from '../features/study/card-summary'
import { parseSimpleJson, toSimpleJson } from '../features/sets/simple-json'

export interface SetSummary {
  readonly id: string
  readonly name: string
  readonly cardCount: number
}

const currentState = () => {
  const result = loadState()
  return result.ok ? result.value : createEmptyAppState()
}

/** Every set currently stored, with its card count. */
const listSets = (): readonly SetSummary[] => {
  const state = currentState()
  return state.sets.map((set) => ({
    id: set.id,
    name: set.name,
    cardCount: state.cards.filter((card) => card.setId === set.id).length,
  }))
}

export interface CardSummary {
  readonly id: string
  readonly front: string
  readonly back: string
}

/** Every card in a set, reduced to {id, front, back} regardless of content kind. */
const listCards = (setId: string): readonly CardSummary[] => {
  const state = currentState()
  return state.cards.filter((card) => card.setId === setId).map((card) => ({ id: card.id, ...cardFrontBack(card) }))
}

/** The full Seshat set-export JSON for one set, or `null` if it doesn't exist. */
const exportSet = (setId: string): ExportedSet | null => {
  const state = currentState()
  const set = state.sets.find((candidate) => candidate.id === setId)
  if (set === undefined) return null
  const cards = state.cards.filter((card) => card.setId === setId)
  return {
    seshatExportVersion: 1,
    name: set.name,
    description: set.description,
    tags: set.tags,
    cards: cards.map((card) => ({
      prompt: card.prompt,
      content: card.content,
      explanation: card.explanation,
      sourceRef: card.sourceRef,
      tags: card.tags,
    })),
  }
}

/** The portable term/definition JSON for one set, or `null` if it doesn't exist. */
const exportSetSimple = (
  setId: string,
): {
  readonly name: string
  readonly terms: readonly { readonly term: string; readonly definition: string }[]
} | null => {
  const state = currentState()
  const set = state.sets.find((candidate) => candidate.id === setId)
  if (set === undefined) return null
  const cards = state.cards.filter((card) => card.setId === setId)
  return toSimpleJson(set.name, cards)
}

const insertSet = (exported: ExportedSet): StudySet => {
  const state = currentState()
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
  saveState({ ...state, sets: [...state.sets, set], cards: [...state.cards, ...cards] })
  return set
}

/** Imports a full Seshat set-export object (already parsed JSON, not a string). */
const importSet = (json: unknown): Result<SetSummary, string> => {
  const parsed = exportedSetSchema.safeParse(json)
  if (!parsed.success) return err(parsed.error.issues.map((issue) => issue.message).join('; '))
  const set = insertSet(parsed.data)
  return ok({ id: set.id, name: set.name, cardCount: parsed.data.cards.length })
}

/** Imports a term/definition JSON string (bare array or {name/title, terms}). `setName` is used only if the file has none. */
const importSimpleJson = (raw: string, setName?: string): Result<SetSummary, string> => {
  const parsed = parseSimpleJson(raw)
  if (!parsed.ok) return err(parsed.error)
  const name = parsed.value.name ?? setName
  if (name === undefined || name.trim() === '')
    return err('This file has no set name — pass one as the second argument.')
  const set = insertSet({ seshatExportVersion: 1, name, description: '', tags: [], cards: parsed.value.cards })
  return ok({ id: set.id, name: set.name, cardCount: parsed.value.cards.length })
}

export interface SeshatWindowApi {
  readonly listSets: typeof listSets
  readonly listCards: typeof listCards
  readonly exportSet: typeof exportSet
  readonly exportSetSimple: typeof exportSetSimple
  readonly importSet: typeof importSet
  readonly importSimpleJson: typeof importSimpleJson
  readonly cardFrontBack: typeof cardFrontBack
}

export const seshatWindowApi: SeshatWindowApi = {
  listSets,
  listCards,
  exportSet,
  exportSetSimple,
  importSet,
  importSimpleJson,
  cardFrontBack,
}

declare global {
  interface Window {
    seshat: SeshatWindowApi
  }
}
