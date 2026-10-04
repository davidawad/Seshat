/**
 * A zero-backend JS API exposed on `window.seshat` — for bookmarklets,
 * browser-console scripting, userscripts, or any other same-page script
 * that wants to read or write Seshat's data. This is the "browser-only
 * API, no backend" version of programmatic access: there is no server to
 * expose an HTTP/MCP endpoint from (a browser tab cannot accept incoming
 * connections), so this API works directly against `localStorage`
 * instead, through the same `loadState`/`saveState` the app itself uses.
 *
 * Writes dispatch a `seshat:external-write` window event after saving;
 * the store listens for it and reloads, so an open tab updates live (the
 * browser's own `storage` event never fires in the tab that did the
 * writing, hence the explicit event). Reads always see what is persisted,
 * which can trail React state by one render if a script runs mid-edit.
 */
import { newCardId, newSetId } from './id'
import {
  type Backup,
  type ImportMode,
  type ImportReport,
  applyBackup,
  attachBackupMedia,
  createBackup,
  parseBackup,
} from './backup'
import { getSharedMediaStore } from './media/default-store'
import { loadMediaMap } from './media/export'
import { processImage } from './media/image-pipeline'
import { prepareCardsForImport } from './media/import-prepare'
import { collectMediaRefs } from './media/refs'
import { mediaSummary } from './media/refs'
import { loadKeybindingOverrides, saveKeybindingOverrides } from './keybindingStorage'
import { notifyExternalWrite } from './persistence'
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
  /** Stored image as {id, alt, width, height} (never bytes). */
  readonly image?: ReturnType<typeof mediaSummary>
  /** LEGACY inline image, present only for cards the boot migration has not converted. */
  readonly imageDataUrl?: string
}

/** Every card in a set, reduced to {id, front, back (+ image summary)} regardless of content kind. */
const listCards = (setId: string): readonly CardSummary[] => {
  const state = currentState()
  return state.cards
    .filter((card) => card.setId === setId)
    .map((card) => {
      const { image, ...faces } = cardFrontBack(card)
      return { id: card.id, ...faces, ...(image === undefined ? {} : { image: mediaSummary(image) }) }
    })
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
      promptImage: card.promptImage,
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
  notifyExternalWrite()
  return set
}

const ingestDeps = () => ({ store: getSharedMediaStore(), process: (blob: Blob) => processImage(blob) })

/**
 * Imports a full Seshat set-export object (already parsed JSON, not a string). Async: embedded `media` (and v1-era
 * inline data-URL images) are stored first, so the cards' images are there by the time the set appears.
 */
const importSet = async (json: unknown): Promise<Result<SetSummary, string>> => {
  const parsed = exportedSetSchema.safeParse(json)
  if (!parsed.success) return err(parsed.error.issues.map((issue) => issue.message).join('; '))
  const prepared = await prepareCardsForImport(parsed.data.cards, parsed.data.media, ingestDeps())
  if (!prepared.ok) return err(prepared.error)
  const { media: _embedded, ...rest } = parsed.data
  const set = insertSet({ ...rest, cards: prepared.value.cards })
  return ok({ id: set.id, name: set.name, cardCount: prepared.value.cards.length })
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

/** Everything — settings, keybindings, sets, cards, review history — as one backup object. Images are MediaRefs only (no bytes). */
const exportAll = (): Backup => createBackup(currentState(), loadKeybindingOverrides(), new Date())

/** Like `exportAll`, with every referenced image's bytes embedded (base64 `media` map): a self-contained backup. */
const exportAllWithMedia = async (): Promise<Backup> =>
  (await attachBackupMedia(exportAll(), getSharedMediaStore())).value

/** Like `exportSet`, with the images' bytes embedded in a `media` map. `null` if the set does not exist. */
const exportSetWithMedia = async (setId: string): Promise<ExportedSet | null> => {
  const exported = exportSet(setId)
  if (exported === null) return null
  const { value } = await loadMediaMap(getSharedMediaStore(), collectMediaRefs(exported.cards))
  return { ...exported, media: value }
}

/** Restores a backup JSON string. `replace` swaps everything; `merge` only adds sets/cards whose ids are missing. Async (stores the images first). */
const importAll = async (json: string, mode: ImportMode): Promise<Result<ImportReport, string>> => {
  const backup = parseBackup(json)
  if (!backup.ok) return err(backup.error)
  const prepared = await prepareCardsForImport(backup.value.cards, backup.value.media, ingestDeps())
  if (!prepared.ok) return err(prepared.error)
  const { state, report: base } = applyBackup(
    currentState(),
    { ...backup.value, cards: prepared.value.cards, media: {} },
    mode,
  )
  const report = { ...base, imagesMissing: prepared.value.missing, imagesNotConverted: prepared.value.notConverted }
  const saved = saveState(state)
  if (!saved.ok) return err(`Could not save the restored data (${saved.error.kind}).`)
  if (report.keybindings !== null) saveKeybindingOverrides(report.keybindings)
  notifyExternalWrite()
  return ok(report)
}

export interface SeshatWindowApi {
  readonly listSets: typeof listSets
  readonly listCards: typeof listCards
  readonly exportSet: typeof exportSet
  readonly exportSetSimple: typeof exportSetSimple
  readonly importSet: typeof importSet
  readonly importSimpleJson: typeof importSimpleJson
  readonly exportAll: typeof exportAll
  readonly exportAllWithMedia: typeof exportAllWithMedia
  readonly exportSetWithMedia: typeof exportSetWithMedia
  readonly importAll: typeof importAll
  readonly cardFrontBack: typeof cardFrontBack
}

export const seshatWindowApi: SeshatWindowApi = {
  listSets,
  listCards,
  exportSet,
  exportSetSimple,
  importSet,
  importSimpleJson,
  exportAll,
  exportAllWithMedia,
  exportSetWithMedia,
  importAll,
  cardFrontBack,
}

declare global {
  interface Window {
    seshat: SeshatWindowApi
  }
}
