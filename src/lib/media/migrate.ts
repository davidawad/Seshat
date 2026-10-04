import { type AppState, type Result, err, ok } from '../../types'
import { LEGACY_STORAGE_KEY, STORAGE_KEY, parseLegacyState, parseState } from '../storage'
import { type StorageError, readLocal, removeLocal, writeLocal } from '../persistence'
import { type IngestDeps, type IngestStage, IngestError, cachedIngest, hasLegacyImage, upgradeCards } from './ingest'
import type { LegacyStore } from './legacy-store'
import { MIGRATE_LOCK, type WithLock } from './locks'

/**
 * Boot migration from app-state v1 (images inline as data URLs) to v2 (cards
 * hold MediaRefs; blobs live in IndexedDB). The one rule: v1 is deleted only
 * after EVERYTHING else is proven. In order, and any failure stops the run
 * with v1 untouched (the app then keeps running on the v1 data, and the next
 * boot retries):
 *
 *   1. v1 parses (a corrupt v1 is never touched);
 *   2. each distinct image is decoded, run through the image pipeline (which
 *      never upscales), stored, READ BACK and re-hashed against its id;
 *   3. the raw v1 string is written to the IndexedDB 'legacy' store and read
 *      back equal (the rollback copy; skipped when there are no images, since
 *      the v2 state is then the same text);
 *   4. the v2 blob (text + refs only) is built, re-parsed and written, and
 *      read back equal;
 *   5. only now is the v1 key removed. If that removal fails, v2 is already
 *      the source of truth and the stale v1 is cleaned up on a later boot
 *      (only when it provably equals the rollback copy).
 *
 * Exactly-once across tabs: runs under `navigator.locks` ('seshat-migrate-v2')
 * and re-checks "v2 absent" inside the lock; without locks the same re-check
 * runs synchronously immediately before the v2 write.
 */

/** Key of the pre-migration copy of the raw v1 state in the legacy store. */
export const LEGACY_COPY_KEY = 'app-state-v1'
/** Key under which restore parks the v2 state it is about to replace. */
export const BEFORE_RESTORE_KEY = 'app-state-v2-before-restore'

export interface StateStorage {
  read(key: string): string | null
  write(key: string, value: string): Result<void, StorageError>
  remove(key: string): void
}

export const browserStateStorage: StateStorage = { read: readLocal, write: writeLocal, remove: removeLocal }

export interface MigrationDeps extends IngestDeps {
  readonly storage: StateStorage
  readonly legacy: LegacyStore
  readonly withLock: WithLock
}

export type MigrationStage = IngestStage | 'parse' | 'legacy-copy' | 'write-v2' | 'unexpected'

export type MigrationOutcome =
  | { readonly status: 'not-needed' }
  | { readonly status: 'migrated'; readonly images: number; readonly v1Removed: boolean }
  | { readonly status: 'failed'; readonly stage: MigrationStage; readonly message: string }

class MigrationFailure extends Error {
  readonly stage: MigrationStage
  constructor(stage: MigrationStage, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'MigrationFailure'
    this.stage = stage
  }
}

const NOT_NEEDED: MigrationOutcome = { status: 'not-needed' }

const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))

const failureOutcome = (cause: unknown): MigrationOutcome => ({
  status: 'failed',
  stage: cause instanceof IngestError || cause instanceof MigrationFailure ? cause.stage : 'unexpected',
  message: messageOf(cause),
})

/** Cheap synchronous check for the boot fast path: v1 exists and v2 does not. */
export const migrationPending = (storage: StateStorage = browserStateStorage): boolean =>
  storage.read(STORAGE_KEY) === null && storage.read(LEGACY_STORAGE_KEY) !== null

/** v2 already exists but a v1 key is still around (a previous v1 removal failed). */
export const staleV1Present = (storage: StateStorage = browserStateStorage): boolean =>
  storage.read(STORAGE_KEY) !== null && storage.read(LEGACY_STORAGE_KEY) !== null

const distinctImages = (state: AppState): number =>
  new Set(
    state.cards.flatMap(({ content }) =>
      content.kind === 'image-occlusion' && hasLegacyImage(content) && content.imageDataUrl !== undefined
        ? [content.imageDataUrl]
        : [],
    ),
  ).size

const saveRollbackCopy = async (raw: string, legacy: LegacyStore): Promise<void> => {
  try {
    await legacy.put(LEGACY_COPY_KEY, raw)
    const back = await legacy.get(LEGACY_COPY_KEY)
    if (back !== raw) throw new Error('the saved copy does not match')
  } catch (cause) {
    throw new MigrationFailure('legacy-copy', `Could not save a rollback copy: ${messageOf(cause)}`, { cause })
  }
}

/** Writes v2 and proves it landed; on any doubt removes what it wrote and throws (v1 is still intact). */
const commitV2 = (next: AppState, storage: StateStorage, v1Raw: string): boolean => {
  const serialized = JSON.stringify(next)
  const reparsed = parseState(serialized)
  if (!reparsed.ok) throw new MigrationFailure('write-v2', 'The upgraded data did not validate.')
  if (next.cards.some((card) => hasLegacyImage(card.content))) {
    throw new MigrationFailure('write-v2', 'An inline image was left in the upgraded data.')
  }
  // Re-check immediately before writing (synchronous: no other work runs between check and write in this tab).
  if (storage.read(STORAGE_KEY) !== null) return false
  // v1 changed while we worked (a tab still running on v1 saved): what we upgraded is stale. Retry next boot.
  if (storage.read(LEGACY_STORAGE_KEY) !== v1Raw) {
    throw new MigrationFailure('write-v2', 'Your data changed while it was being upgraded; trying again next time.')
  }
  try {
    const written = storage.write(STORAGE_KEY, serialized)
    if (!written.ok) throw new Error(written.error.kind)
    if (storage.read(STORAGE_KEY) !== serialized) throw new Error('read-back mismatch')
  } catch (cause) {
    storage.remove(STORAGE_KEY)
    throw new MigrationFailure('write-v2', `Could not save the upgraded data: ${messageOf(cause)}`, { cause })
  }
  return true
}

const attempt = async (deps: MigrationDeps): Promise<MigrationOutcome> => {
  if (deps.storage.read(STORAGE_KEY) !== null) return NOT_NEEDED
  const raw = deps.storage.read(LEGACY_STORAGE_KEY)
  if (raw === null) return NOT_NEEDED
  const parsed = parseLegacyState(raw)
  if (!parsed.ok) {
    return { status: 'failed', stage: 'parse', message: 'The saved data is not readable, so it was left untouched.' }
  }
  try {
    const images = distinctImages(parsed.value)
    const ingest = cachedIngest(deps)
    const next: AppState = { ...parsed.value, cards: await upgradeCards(parsed.value.cards, ingest) }
    if (images > 0) await saveRollbackCopy(raw, deps.legacy)
    if (!commitV2(next, deps.storage, raw)) return NOT_NEEDED
    // Only remove the v1 we migrated; a v1 that changed since is left for the stale-v1 rules.
    if (deps.storage.read(LEGACY_STORAGE_KEY) === raw) deps.storage.remove(LEGACY_STORAGE_KEY)
    return { status: 'migrated', images, v1Removed: deps.storage.read(LEGACY_STORAGE_KEY) === null }
  } catch (cause) {
    return failureOutcome(cause)
  }
}

/** Removes a stale v1 key, but only when it is byte-identical to the verified rollback copy. */
const cleanStaleV1 = async (deps: MigrationDeps): Promise<void> => {
  if (!staleV1Present(deps.storage)) return
  try {
    const copy = await deps.legacy.get(LEGACY_COPY_KEY)
    if (copy !== null && copy === deps.storage.read(LEGACY_STORAGE_KEY)) deps.storage.remove(LEGACY_STORAGE_KEY)
  } catch {
    // Best effort: a stale v1 is harmless and is retried on the next boot.
  }
}

/** Runs the migration once under the cross-tab lock. Never throws; a failure leaves v1 untouched. */
export const runMigration = (deps: MigrationDeps): Promise<MigrationOutcome> =>
  deps.withLock(MIGRATE_LOCK, async () => {
    const outcome = await attempt(deps).catch(failureOutcome)
    if (outcome.status === 'not-needed') await cleanStaleV1(deps)
    return outcome
  })

/**
 * Settings -> "Restore previous version of my data". Replaces the current v2
 * state with the pre-migration copy (images back inline as data URLs), after
 * parking the current v2 state in the legacy store so this is itself
 * reversible. Writes only after both copies are verified; a failed write
 * leaves the current state exactly as it was.
 */
export const restoreLegacyCopy = async (
  deps: Pick<MigrationDeps, 'storage' | 'legacy'>,
): Promise<Result<AppState, string>> => {
  let raw: string | null
  try {
    raw = await deps.legacy.get(LEGACY_COPY_KEY)
  } catch (cause) {
    return err(`Could not read the saved copy: ${messageOf(cause)}`)
  }
  if (raw === null) return err('There is no previous version saved on this device.')
  const parsed = parseLegacyState(raw)
  if (!parsed.ok) return err('The saved previous version is not readable.')

  const current = deps.storage.read(STORAGE_KEY)
  try {
    if (current !== null) {
      await deps.legacy.put(BEFORE_RESTORE_KEY, current)
      if ((await deps.legacy.get(BEFORE_RESTORE_KEY)) !== current) throw new Error('the parked copy does not match')
    }
  } catch (cause) {
    return err(`Could not set the current data aside first, so nothing was changed: ${messageOf(cause)}`)
  }

  const written = deps.storage.write(STORAGE_KEY, JSON.stringify(parsed.value))
  if (!written.ok) return err(`Could not restore (${written.error.kind}); your current data was not changed.`)
  return ok(parsed.value)
}

/** True when a pre-migration copy is available to restore. */
export const hasLegacyCopy = async (legacy: LegacyStore): Promise<boolean> => {
  try {
    return (await legacy.get(LEGACY_COPY_KEY)) !== null
  } catch {
    return false
  }
}
