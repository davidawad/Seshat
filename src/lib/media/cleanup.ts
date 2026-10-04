import type { AppState, Result } from '../../types'
import { collectReferencedIds, selectOrphans } from './gc'
import { GC_LOCK, type WithLock } from './locks'
import { cardMediaRefs } from './refs'
import type { MediaStore } from './store'

/** Every media id any card in `state` points at (see refs.ts for what counts as a reference). */
export const referencedMediaIds = (state: AppState): ReadonlySet<string> =>
  collectReferencedIds(state.cards, (card) => cardMediaRefs(card).map((ref) => ref.id))

export type CleanupResult =
  | { readonly status: 'done'; readonly deleted: number; readonly freedBytes: number }
  | { readonly status: 'skipped'; readonly reason: string }

export interface CleanupDeps {
  readonly store: MediaStore
  /** Reads the PERSISTED state fresh (other tabs may have saved newer references than this tab's memory). */
  readonly readState: () => Result<AppState, unknown>
  /** True while the v1 -> v2 migration has not finished (its blobs may not be referenced yet). */
  readonly migrationPending: () => boolean
  readonly withLock: WithLock
  readonly now?: () => number
}

/**
 * On-demand "Clean up unused images". Deletes only blobs that are (a) not
 * referenced by anything in the freshly-read persisted state, and (b) older than
 * the 24h grace period (see selectOrphans), under the cross-tab GC lock. Any
 * doubt (unreadable state, migration still pending) deletes nothing.
 */
export const cleanUpUnusedImages = (deps: CleanupDeps): Promise<CleanupResult> =>
  deps.withLock(GC_LOCK, async (): Promise<CleanupResult> => {
    if (deps.migrationPending()) return { status: 'skipped', reason: 'Your data is still being upgraded.' }
    const state = deps.readState()
    if (!state.ok) return { status: 'skipped', reason: 'Your saved data could not be read, so nothing was deleted.' }

    const stored = await deps.store.list()
    const orphans = selectOrphans(
      stored.map((item) => item.id),
      referencedMediaIds(state.value),
      {
        nowMs: (deps.now ?? Date.now)(),
        createdAtById: new Map(stored.map((item) => [item.id, item.createdAt])),
      },
    )
    const bytesById = new Map(stored.map((item) => [item.id, item.bytes]))
    let freedBytes = 0
    for (const id of orphans) {
      await deps.store.delete(id)
      freedBytes += bytesById.get(id) ?? 0
    }
    return { status: 'done', deleted: orphans.length, freedBytes }
  })
