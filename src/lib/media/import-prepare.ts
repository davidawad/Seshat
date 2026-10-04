import { type Result, err, ok } from '../../types'
import { IngestError, type IngestDeps, cachedIngest, ingestMediaMap, upgradeCardsLenient } from './ingest'
import { type MediaCard, collectMediaRefs } from './refs'
import type { MediaMap } from './types'

export interface PreparedCards<T> {
  /** The cards, with embedded legacy images converted to stored MediaRefs where possible. */
  readonly cards: T[]
  /** Cards whose legacy inline image could not be converted; they keep their data URL and still render. */
  readonly notConverted: number
  /** Distinct referenced images that are in neither the file's media nor the local store (they will show as unavailable). */
  readonly missing: number
}

/**
 * The async half of importing a backup or set export: put the file's `media`
 * into the store (each blob must hash to the id it is filed under), convert any
 * v1-era inline data URLs through the image pipeline, and count what could not
 * be provided. Runs BEFORE the caller dispatches state, so an image is in the
 * store by the time a card that refers to it can render. A bad media entry
 * fails the whole import (nothing is changed); a bad legacy image only keeps
 * its data URL.
 */
export const prepareCardsForImport = async <T extends MediaCard>(
  cards: readonly T[],
  media: MediaMap | undefined,
  deps: IngestDeps,
): Promise<Result<PreparedCards<T>, string>> => {
  try {
    if (media !== undefined) await ingestMediaMap(deps.store, media)
  } catch (cause) {
    return err(
      cause instanceof IngestError ? `Could not import the images in this file: ${cause.message}` : String(cause),
    )
  }
  const upgraded = await upgradeCardsLenient(cards, cachedIngest(deps))
  let missing = 0
  for (const id of collectMediaRefs(upgraded.cards).keys()) {
    if (!(await deps.store.has(id).catch(() => false))) missing += 1
  }
  return ok({ cards: upgraded.cards, notConverted: upgraded.failed, missing })
}
