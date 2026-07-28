import { describe, expect, it } from 'vitest'
import type { CardId } from '../../types'
import { type MatchPair, createRound, layoutTiles, pickRoundPairs } from './round'

const makePairs = (count: number): MatchPair[] =>
  Array.from({ length: count }, (_, i) => ({
    cardId: `card-${i}` as CardId,
    front: `front-${i}`,
    back: `back-${i}`,
  }))

/** A fixed, non-random sequence so shuffling is deterministic in tests. */
const fakeRandomSequence = (values: readonly number[]): (() => number) => {
  let i = 0
  return () => {
    const value = values[i % values.length] as number
    i += 1
    return value
  }
}

describe('pickRoundPairs', () => {
  it('uses every pair when the deck is at or under the cap', () => {
    const pairs = makePairs(5)
    const result = pickRoundPairs(pairs, 8)
    expect(result).toHaveLength(5)
    expect(new Set(result.map((p) => p.cardId))).toEqual(new Set(pairs.map((p) => p.cardId)))
  })

  it('uses every pair when the deck exactly equals the cap', () => {
    const pairs = makePairs(8)
    const result = pickRoundPairs(pairs, 8)
    expect(result).toHaveLength(8)
  })

  it('caps at `cap` pairs when the deck is larger, choosing a subset', () => {
    const pairs = makePairs(20)
    const result = pickRoundPairs(pairs, 8, Math.random)
    expect(result).toHaveLength(8)
    const ids = result.map((p) => p.cardId)
    expect(new Set(ids).size).toBe(8) // no duplicate pairs chosen
    for (const id of ids) {
      expect(pairs.some((p) => p.cardId === id)).toBe(true)
    }
  })

  it('is deterministic for a fixed random source', () => {
    const pairs = makePairs(4)
    const random = fakeRandomSequence([0.1, 0.2, 0.3, 0.9])
    const a = pickRoundPairs(pairs, 8, random)
    const random2 = fakeRandomSequence([0.1, 0.2, 0.3, 0.9])
    const b = pickRoundPairs(pairs, 8, random2)
    expect(a).toEqual(b)
  })
})

describe('layoutTiles', () => {
  it('produces exactly 2 tiles per pair', () => {
    const pairs = makePairs(6)
    const tiles = layoutTiles(pairs)
    expect(tiles).toHaveLength(12)
  })

  it('has no duplicate tile ids', () => {
    const pairs = makePairs(6)
    const tiles = layoutTiles(pairs)
    const ids = tiles.map((t) => t.tileId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('includes every card front and back exactly once', () => {
    const pairs = makePairs(5)
    const tiles = layoutTiles(pairs)
    for (const pair of pairs) {
      const fronts = tiles.filter((t) => t.cardId === pair.cardId && t.side === 'front')
      const backs = tiles.filter((t) => t.cardId === pair.cardId && t.side === 'back')
      expect(fronts).toHaveLength(1)
      expect(fronts[0]?.text).toBe(pair.front)
      expect(backs).toHaveLength(1)
      expect(backs[0]?.text).toBe(pair.back)
    }
  })

  it('actually reorders tiles given a fixed non-identity random sequence', () => {
    const pairs = makePairs(6) // 12 tiles, unshuffled order: f0,b0,f1,b1,...
    const unshuffledIds = pairs.flatMap((p) => [`${p.cardId}:front`, `${p.cardId}:back`])
    // A sequence engineered to move indices around rather than leave them in place.
    const random = fakeRandomSequence([0.99, 0.05, 0.8, 0.15, 0.6, 0.25, 0.4, 0.35, 0.2, 0.55, 0.9, 0.1])
    const tiles = layoutTiles(pairs, random)
    const shuffledIds = tiles.map((t) => t.tileId)
    expect(shuffledIds).not.toEqual(unshuffledIds)
    expect(new Set(shuffledIds)).toEqual(new Set(unshuffledIds))
  })

  it('returns an empty layout for zero pairs', () => {
    expect(layoutTiles([])).toEqual([])
  })

  it('does not mutate its input', () => {
    const pairs = makePairs(3)
    const snapshot = [...pairs]
    layoutTiles(pairs)
    expect(pairs).toEqual(snapshot)
  })
})

describe('createRound', () => {
  it('composes picking and layout: 2 * min(cap, pairCount) tiles', () => {
    const smallDeck = makePairs(3)
    expect(createRound(smallDeck, 8)).toHaveLength(6)

    const bigDeck = makePairs(20)
    expect(createRound(bigDeck, 8)).toHaveLength(16)
  })

  it('every tile in the round belongs to one of the pairs actually selected', () => {
    const pairs = makePairs(20)
    const random = fakeRandomSequence([0.11, 0.22, 0.33, 0.44, 0.55, 0.66, 0.77, 0.88, 0.99, 0.05])
    const tiles = createRound(pairs, 8, random)
    const cardIds = new Set(tiles.map((t) => t.cardId))
    expect(cardIds.size).toBe(8)
    // Each selected card contributes exactly one front and one back tile.
    for (const cardId of cardIds) {
      expect(tiles.filter((t) => t.cardId === cardId)).toHaveLength(2)
    }
  })
})
