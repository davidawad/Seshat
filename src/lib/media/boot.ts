import { createIdbMediaStore } from './idb-store'
import { processImage } from './image-pipeline'
import { createIdbLegacyStore } from './legacy-store'
import { withWebLock } from './locks'
import {
  type MigrationDeps,
  type MigrationOutcome,
  browserStateStorage,
  migrationPending,
  runMigration,
  staleV1Present,
} from './migrate'
import { noticeFor, setMigrationNotice } from './migration-notice'

/** The real browser wiring: IndexedDB stores (never the memory fallback: a memory copy is not durable), the image pipeline, Web Locks. */
export const browserMigrationDeps = (): MigrationDeps => ({
  storage: browserStateStorage,
  store: createIdbMediaStore(),
  legacy: createIdbLegacyStore(),
  process: (blob) => processImage(blob),
  withLock: withWebLock,
})

/**
 * Called once before the app mounts. Resolves with the outcome and records a
 * non-blocking notice for the UI. Never rejects: a failed migration just means
 * the app runs on the v1 data (see storage.ts) and retries next boot. Only
 * awaited by the caller when `migrationPending()` is true; a stale-v1 cleanup
 * runs in the background.
 */
export const bootMigration = async (deps: MigrationDeps = browserMigrationDeps()): Promise<MigrationOutcome> => {
  if (!migrationPending(deps.storage) && !staleV1Present(deps.storage)) return { status: 'not-needed' }
  const outcome = await runMigration(deps)
  setMigrationNotice(noticeFor(outcome))
  return outcome
}
