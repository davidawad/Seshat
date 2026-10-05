import {
  type AppState,
  APP_STATE_VERSION,
  DEFAULT_SETTINGS,
  type Result,
  type Settings,
  err,
  ok,
  settingsSchema,
} from '../types'
import { BACKUP_FORMAT, BACKUP_VERSION, backupSchema } from './backup-schema'
import { type MediaExport, loadMediaMap, toJsonBlobWithMedia } from './media/export'
import { collectMediaRefs } from './media/refs'
import type { MediaStore } from './media/store'
import type { MediaMap } from './media/types'
import { type KeybindingOverrides, sanitizeOverrides } from './keybindings'
import { parseSettingsPatch } from './settings-patch'

/**
 * Whole-app backup: one self-describing JSON file holding every setting,
 * keybinding override, set, card and review-log entry. Unlike the per-set
 * export (`ExportedSet`, which deliberately drops scheduling so you don't
 * import someone else's memory model), a backup is *your own* complete
 * state and keeps FSRS scheduling and review history intact.
 *
 * The file is untrusted input on the way back in: `parseBackup` is strict
 * (unknown envelope/settings fields are rejected, ids must be unique,
 * cards/log entries must reference things that exist) and size-capped.
 * Format evolution: bump `BACKUP_VERSION`, add the new envelope schema,
 * and register a `version N -> N+1` step in `MIGRATIONS`; old files are
 * migrated forward before the strict parse, so only the newest schema is
 * ever validated against.
 */

export { BACKUP_FORMAT, BACKUP_VERSION }

/** Rejects absurd inputs before JSON.parse allocates for them. (Characters, not bytes — close enough for a sanity cap.) */
export const MAX_BACKUP_CHARS = 25 * 1024 * 1024
/**
 * Hard ceiling for a file that DECLARES media (a non-empty `"media":{"<id>":...` map): images are base64 and
 * legitimately large. Still bounded, so a hostile file cannot make JSON.parse allocate without limit.
 */
export const MAX_BACKUP_WITH_MEDIA_CHARS = 256 * 1024 * 1024
const DECLARES_MEDIA = /"media"\s*:\s*\{\s*"/

/** Size-aware cap: the plain cap, or the larger media cap for a file that declares images. */
const exceedsSizeCap = (raw: string): boolean => {
  if (raw.length <= MAX_BACKUP_CHARS) return false
  return raw.length > MAX_BACKUP_WITH_MEDIA_CHARS || !DECLARES_MEDIA.test(raw)
}

// Informational only (never gates an import — `version` does). Set VITE_APP_VERSION at build time to stamp it.
const envAppVersion: unknown = import.meta.env['VITE_APP_VERSION']
const APP_VERSION = typeof envAppVersion === 'string' ? envAppVersion : '0.0.0'

export interface Backup {
  readonly format: typeof BACKUP_FORMAT
  readonly version: typeof BACKUP_VERSION
  readonly appVersion: string
  readonly exportedAt: string
  readonly settings: Settings
  readonly keybindings: KeybindingOverrides
  readonly sets: AppState['sets']
  readonly cards: AppState['cards']
  readonly reviewLog: AppState['reviewLog']
  /** mediaId -> image bytes for every image the cards reference. `{}` for a text-only backup. */
  readonly media: MediaMap
}

export const createBackup = (state: AppState, keybindings: KeybindingOverrides, now: Date): Backup => ({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  appVersion: APP_VERSION,
  exportedAt: now.toISOString(),
  settings: state.settings,
  keybindings,
  sets: state.sets,
  cards: state.cards,
  reviewLog: state.reviewLog,
  media: {},
})

/** A backup with the bytes of every referenced image attached (held in memory; see `buildBackupBlob` for files). */
export const attachBackupMedia = async (backup: Backup, store: MediaStore): Promise<MediaExport<Backup>> => {
  const { value, missing } = await loadMediaMap(store, collectMediaRefs(backup.cards))
  return { value: { ...backup, media: value }, missing }
}

/** The backup as a downloadable Blob built from parts (images streamed in one at a time), plus ids whose blobs were missing. */
export const buildBackupBlob = (backup: Backup, store: MediaStore): Promise<MediaExport<Blob>> => {
  const { media: _text, ...doc } = backup
  return toJsonBlobWithMedia(doc, store, collectMediaRefs(backup.cards))
}

/** `seshat-backup-2026-10-03.json` — the date, not a timestamp, so repeated exports sort and stay readable. */
export const backupFilename = (now: Date): string => `seshat-backup-${now.toISOString().slice(0, 10)}.json`

// ---------------------------------------------------------------------------
// Migration chain
// ---------------------------------------------------------------------------

type RawEnvelope = Readonly<Record<string, unknown>>

/** `MIGRATIONS[n]` upgrades a version-n envelope to version n+1. */
export type MigrationChain = Readonly<Record<number, (raw: RawEnvelope) => RawEnvelope>>

export const MIGRATIONS: MigrationChain = {
  // v1 -> v2: images used to be inline data URLs in the cards (kept as-is here, converted into the media
  // store at import time by prepareCardsForImport); v2 adds the `media` map, empty for a v1 file.
  1: (raw) => ({ ...raw, version: 2, media: {} }),
}

/** Walks a raw envelope forward, one version at a time, to `target`. Injectable so the chain is testable on its own. */
export const migrateEnvelope = (
  raw: RawEnvelope,
  migrations: MigrationChain = MIGRATIONS,
  target: number = BACKUP_VERSION,
): Result<RawEnvelope, string> => {
  const version = raw['version']
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return err('This backup has no valid version number.')
  }
  if (version > target) {
    return err(
      `This backup is from a newer version of Seshat (backup format v${version}); update the app to restore it.`,
    )
  }

  let current = raw
  for (let step = version; step < target; step++) {
    const migrate = migrations[step]
    if (migrate === undefined) return err(`No migration from backup format v${step}.`)
    current = migrate(current)
  }
  return ok(current)
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

const duplicates = (ids: readonly string[]): boolean => new Set(ids).size !== ids.length

/** Referential checks the per-field schemas can't express. Returns an error message, or `null` when consistent. */
const mediaIntegrityError = (backup: Backup): string | null => {
  const used = collectMediaRefs(backup.cards)
  return Object.keys(backup.media).some((id) => !used.has(id)) ? 'This backup contains images that no card uses.' : null
}

const integrityError = (backup: Backup): string | null => {
  const mediaProblem = mediaIntegrityError(backup)
  if (mediaProblem !== null) return mediaProblem
  if (duplicates(backup.sets.map((set) => set.id))) return 'This backup contains duplicate set ids.'
  if (duplicates(backup.cards.map((card) => card.id))) return 'This backup contains duplicate card ids.'
  const setIds = new Set<string>(backup.sets.map((set) => set.id))
  if (backup.cards.some((card) => !setIds.has(card.setId))) return 'This backup has cards that belong to no set.'
  const cardIds = new Set<string>(backup.cards.map((card) => card.id))
  if (backup.reviewLog.some((entry) => !cardIds.has(entry.cardId) || !setIds.has(entry.setId))) {
    return 'This backup has review history for cards that are not in it.'
  }
  return null
}

const isRecord = (value: unknown): value is RawEnvelope =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const parseBackup = (raw: string): Result<Backup, string> => {
  if (exceedsSizeCap(raw)) return err('That file is too large to be a Seshat backup.')

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return err('That file is not valid JSON.')
  }
  if (!isRecord(json) || json['format'] !== BACKUP_FORMAT) return err('That file is not a Seshat backup.')

  const migrated = migrateEnvelope(json)
  if (!migrated.ok) return migrated

  const parsed = backupSchema.safeParse(migrated.value)
  if (!parsed.success) {
    return err(
      `That backup is damaged or has unexpected content: ${parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join('.') || 'file'}: ${issue.message}`)
        .join('; ')}`,
    )
  }

  const patch = parseSettingsPatch(parsed.data.settings)
  if (!patch.ok) return err(`That backup has invalid settings: ${patch.error}`)
  const settings = settingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...patch.value })
  if (!settings.success) return err('That backup has invalid settings.')

  const backup: Backup = {
    ...parsed.data,
    settings: settings.data,
    keybindings: sanitizeOverrides(parsed.data.keybindings).overrides,
  }
  const problem = integrityError(backup)
  return problem === null ? ok(backup) : err(problem)
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export type ImportMode = 'replace' | 'merge'

export interface ImportReport {
  readonly mode: ImportMode
  readonly setsAdded: number
  readonly setsSkipped: number
  readonly cardsAdded: number
  readonly cardsSkipped: number
  readonly reviewsAdded: number
  readonly reviewsSkipped: number
  /** Images the backup's cards use that are neither in the file nor on this device (shown as unavailable). Filled by the importer. */
  readonly imagesMissing: number
  /** Cards whose embedded v1 image could not be converted; they keep working from the inline data URL. Filled by the importer. */
  readonly imagesNotConverted: number
  /** Keybinding overrides the caller must now persist/apply; `null` = leave the current ones (merge never touches settings or keybindings). */
  readonly keybindings: KeybindingOverrides | null
}

export interface ApplyResult {
  readonly state: AppState
  readonly report: ImportReport
}

/**
 * Pure. `replace` swaps all data and settings for the backup's. `merge`
 * only ADDS: sets and cards whose id is not already present, plus the
 * review history of cards it just added. Anything already present —
 * including its review history, scheduling and the current settings — is
 * left exactly as is, so a merge can never overwrite or fork your progress.
 */
export const applyBackup = (current: AppState, backup: Backup, mode: ImportMode): ApplyResult => {
  if (mode === 'replace') {
    return {
      state: {
        version: APP_STATE_VERSION,
        sets: backup.sets,
        cards: backup.cards,
        reviewLog: backup.reviewLog,
        settings: backup.settings,
        // Device-local, not part of a backup: a restore keeps this device's own history and reminder schedule.
        activation: current.activation,
      },
      report: {
        mode,
        setsAdded: backup.sets.length,
        setsSkipped: 0,
        cardsAdded: backup.cards.length,
        cardsSkipped: 0,
        reviewsAdded: backup.reviewLog.length,
        reviewsSkipped: 0,
        imagesMissing: 0,
        imagesNotConverted: 0,
        keybindings: backup.keybindings,
      },
    }
  }

  const haveSet = new Set<string>(current.sets.map((set) => set.id))
  const haveCard = new Set<string>(current.cards.map((card) => card.id))
  const newSets = backup.sets.filter((set) => !haveSet.has(set.id))
  const newCards = backup.cards.filter((card) => !haveCard.has(card.id))
  const addedCardIds = new Set<string>(newCards.map((card) => card.id))
  const newReviews = backup.reviewLog.filter((entry) => addedCardIds.has(entry.cardId))

  return {
    state: {
      ...current,
      sets: [...current.sets, ...newSets],
      cards: [...current.cards, ...newCards],
      reviewLog: [...current.reviewLog, ...newReviews],
    },
    report: {
      mode,
      setsAdded: newSets.length,
      setsSkipped: backup.sets.length - newSets.length,
      cardsAdded: newCards.length,
      cardsSkipped: backup.cards.length - newCards.length,
      reviewsAdded: newReviews.length,
      reviewsSkipped: backup.reviewLog.length - newReviews.length,
      imagesMissing: 0,
      imagesNotConverted: 0,
      keybindings: null,
    },
  }
}

/** One-line human summary of an import, shared by the UI and anything else that reports it. */
export const describeImport = (report: ImportReport): string => {
  const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`
  const added = `${plural(report.setsAdded, 'set')}, ${plural(report.cardsAdded, 'card')} and ${plural(report.reviewsAdded, 'review')}`
  const base =
    report.mode === 'replace'
      ? `Replaced everything with the backup: ${added}.`
      : `Merged ${added} from the backup; skipped ${plural(report.setsSkipped, 'set')} and ${plural(report.cardsSkipped, 'card')} already present.`
  const notes = [
    report.imagesMissing > 0 ? `${plural(report.imagesMissing, 'image')} could not be restored (not in the file).` : '',
    report.imagesNotConverted > 0 ? `${plural(report.imagesNotConverted, 'image')} kept in the old inline format.` : '',
  ].filter((note) => note !== '')
  return [base, ...notes].join(' ')
}
