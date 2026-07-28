import type { CardId } from '../../types'

/**
 * Pure round setup for Match mode: pick a batch of pairs for one round, then
 * lay them out as a shuffled grid of tiles. Kept free of React/DOM so it's
 * fully unit-testable — see round.test.ts.
 */

/** Max pairs shown in a single round. Quizlet's own grid caps around here;
 *  past this a matching grid stops being a quick recognition drill and turns
 *  into a memory/scanning slog. */
export const DEFAULT_PAIR_CAP = 8

export interface MatchPair {
  readonly cardId: CardId
  readonly front: string
  readonly back: string
}

export type TileSide = 'front' | 'back'

export interface MatchTile {
  /** Unique across the whole layout — `${cardId}:${side}`. */
  readonly tileId: string
  readonly cardId: CardId
  readonly side: TileSide
  readonly text: string
}

/** Fisher-Yates shuffle. Pure and injectable-random for deterministic tests. */
const shuffle = <T>(items: readonly T[], random: () => number): T[] => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const swap = result[i] as T
    result[i] = result[j] as T
    result[j] = swap
  }
  return result
}

/**
 * Picks the pairs that will make up one round. If `pairs` fits within `cap`,
 * every pair is used (in a shuffled order, so which pairs appear near which
 * doesn't ossify from the set's own ordering). Otherwise a random subset of
 * size `cap` is chosen.
 */
export const pickRoundPairs = (
  pairs: readonly MatchPair[],
  cap: number = DEFAULT_PAIR_CAP,
  random: () => number = Math.random,
): MatchPair[] => shuffle(pairs, random).slice(0, Math.min(cap, pairs.length))

/**
 * Builds the shuffled tile grid for a round: two tiles per pair (one `front`,
 * one `back`), all `2 * pairs.length` tiles shuffled together in one pass so
 * a term and its matching definition aren't adjacent by default.
 */
export const layoutTiles = (pairs: readonly MatchPair[], random: () => number = Math.random): MatchTile[] => {
  const tiles: MatchTile[] = pairs.flatMap((pair) => [
    { tileId: `${pair.cardId}:front`, cardId: pair.cardId, side: 'front' as const, text: pair.front },
    { tileId: `${pair.cardId}:back`, cardId: pair.cardId, side: 'back' as const, text: pair.back },
  ])
  return shuffle(tiles, random)
}

/** Convenience: picks a round's pairs and lays out its tiles in one call. */
export const createRound = (
  pairs: readonly MatchPair[],
  cap: number = DEFAULT_PAIR_CAP,
  random: () => number = Math.random,
): MatchTile[] => layoutTiles(pickRoundPairs(pairs, cap, random), random)
