const DEFAULT_GRACE_MS = 24 * 60 * 60 * 1000

export interface OrphanClock {
  readonly nowMs: number
  readonly createdAtById: ReadonlyMap<string, number>
  /** Minimum age before an unreferenced id may be collected. Default 24h. */
  readonly graceMs?: number
}

/**
 * Ids safe to delete: stored, unreferenced, and older than the grace period
 * (so an image just put but not yet saved into a card is never collected).
 * An id with no known createdAt is kept.
 */
export const selectOrphans = (
  storedIds: Iterable<string>,
  referencedIds: ReadonlySet<string>,
  { nowMs, createdAtById, graceMs = DEFAULT_GRACE_MS }: OrphanClock,
): readonly string[] =>
  Array.from(storedIds).filter((id) => {
    if (referencedIds.has(id)) return false
    const createdAt = createdAtById.get(id)
    return createdAt !== undefined && nowMs - createdAt >= graceMs
  })

/** Union of media ids referenced by `items`, using `idsOf` to read each item's ids. */
export const collectReferencedIds = <T>(
  items: readonly T[],
  idsOf: (item: T) => readonly string[],
): ReadonlySet<string> => new Set(items.flatMap((item) => idsOf(item)))
