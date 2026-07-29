import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import type { CardId, SetId, StudyCard } from '../../types'
import { countDueCategories, interleaveByCategory, reinsertForRelearning, selectDueQueue } from './dueQueue'

const now = new Date('2026-01-10T00:00:00.000Z')

const makeCard = (id: string, setId: string, dueOffsetMs: number, tags: readonly string[] = []): StudyCard => ({
  id: id as CardId,
  setId: setId as SetId,
  prompt: 'prompt',
  content: { kind: 'short-answer', answer: 'answer', acceptableAnswers: [] },
  explanation: null,
  sourceRef: null,
  tags: [...tags],
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  scheduling: { ...createInitialScheduling(now), due: new Date(now.getTime() + dueOffsetMs).toISOString() },
})

describe('selectDueQueue', () => {
  it('includes only due cards, oldest-due-first', () => {
    const cards: StudyCard[] = [makeCard('c1', 'd1', 0), makeCard('c2', 'd1', -60_000), makeCard('c3', 'd1', 60_000)]
    expect(selectDueQueue(cards, null, now)).toEqual(['c2', 'c1'])
  })

  it('filters to a single set when setId is given', () => {
    const cards: StudyCard[] = [makeCard('c1', 'd1', -1000), makeCard('c2', 'd2', -1000)]
    expect(selectDueQueue(cards, 'd1' as SetId, now)).toEqual(['c1'])
  })

  it('returns an empty queue when nothing is due', () => {
    const cards: StudyCard[] = [makeCard('c1', 'd1', 60_000)]
    expect(selectDueQueue(cards, null, now)).toEqual([])
  })

  it('interleaves the resulting queue by category, oldest-category-first', () => {
    // Oldest due order (by offset) is a1, b1, a2, b2 — categories 'tagA'/'tagB'
    // alternate already here, so this also exercises that round-robin holds
    // when the input isn't blocked to begin with.
    const cards: StudyCard[] = [
      makeCard('a1', 'd1', -400_000, ['tagA']),
      makeCard('b1', 'd1', -300_000, ['tagB']),
      makeCard('a2', 'd1', -200_000, ['tagA']),
      makeCard('b2', 'd1', -100_000, ['tagB']),
    ]
    expect(selectDueQueue(cards, null, now)).toEqual(['a1', 'b1', 'a2', 'b2'])
  })

  it('un-blocks a due order where one category is fully due before another', () => {
    // Oldest-due-first would naturally block: both tagA cards due well
    // before either tagB card. selectDueQueue must still interleave them.
    const cards: StudyCard[] = [
      makeCard('a1', 'd1', -400_000, ['tagA']),
      makeCard('a2', 'd1', -300_000, ['tagA']),
      makeCard('b1', 'd1', -200_000, ['tagB']),
      makeCard('b2', 'd1', -100_000, ['tagB']),
    ]
    expect(selectDueQueue(cards, null, now)).toEqual(['a1', 'b1', 'a2', 'b2'])
  })
})

describe('interleaveByCategory', () => {
  it('returns an empty array unchanged', () => {
    expect(interleaveByCategory([], [])).toEqual([])
  })

  it('leaves a single-category input unchanged (nothing to interleave against)', () => {
    const cards: StudyCard[] = [
      makeCard('a1', 'd1', 0, ['tagA']),
      makeCard('a2', 'd1', 0, ['tagA']),
      makeCard('a3', 'd1', 0, ['tagA']),
    ]
    const dueIds = cards.map((c) => c.id)
    expect(interleaveByCategory(cards, dueIds)).toEqual(dueIds)
  })

  it('leaves an all-due-cards-share-a-tag input unchanged even across different sets', () => {
    const cards: StudyCard[] = [makeCard('a1', 'd1', 0, ['shared']), makeCard('a2', 'd2', 0, ['shared'])]
    const dueIds = cards.map((c) => c.id)
    expect(interleaveByCategory(cards, dueIds)).toEqual(dueIds)
  })

  it('round-robins two blocked categories one card at a time', () => {
    const cards: StudyCard[] = [
      makeCard('a1', 'd1', 0, ['tagA']),
      makeCard('a2', 'd1', 0, ['tagA']),
      makeCard('a3', 'd1', 0, ['tagA']),
      makeCard('b1', 'd1', 0, ['tagB']),
      makeCard('b2', 'd1', 0, ['tagB']),
      makeCard('b3', 'd1', 0, ['tagB']),
    ]
    const dueIds = cards.map((c) => c.id)
    expect(interleaveByCategory(cards, dueIds)).toEqual(['a1', 'b1', 'a2', 'b2', 'a3', 'b3'])
  })

  it('distributes a small group across a much larger one rather than appending it at the end', () => {
    const bigGroup = Array.from({ length: 8 }, (_, i) => makeCard(`a${i}`, 'd1', 0, ['tagA']))
    const smallGroup = [makeCard('b0', 'd1', 0, ['tagB'])]
    const cards: StudyCard[] = [...bigGroup, ...smallGroup]
    const dueIds = cards.map((c) => c.id)

    const result = interleaveByCategory(cards, dueIds)

    expect(result).toHaveLength(9)
    // The lone tagB card must land in the first slot (round-robin cycles
    // through non-empty groups starting at category 0, so it appears
    // immediately, not only after all 8 tagA cards have been dealt).
    expect(result[1]).toBe('b0')
    expect(result.filter((id) => id === 'b0')).toHaveLength(1)
    // All ids preserved, no duplication or loss.
    expect(new Set(result)).toEqual(new Set(dueIds))
  })

  it('falls back to setId as the category for cards with no tags', () => {
    const cards: StudyCard[] = [makeCard('x1', 'setX', 0), makeCard('x2', 'setX', 0), makeCard('y1', 'setY', 0)]
    const dueIds = cards.map((c) => c.id)
    expect(interleaveByCategory(cards, dueIds)).toEqual(['x1', 'y1', 'x2'])
  })

  it('mixes tagged and untagged (setId-fallback) categories together', () => {
    const cards: StudyCard[] = [
      makeCard('a1', 'd1', 0, ['tagA']),
      makeCard('a2', 'd1', 0, ['tagA']),
      makeCard('u1', 'setU', 0),
      makeCard('u2', 'setU', 0),
    ]
    const dueIds = cards.map((c) => c.id)
    expect(interleaveByCategory(cards, dueIds)).toEqual(['a1', 'u1', 'a2', 'u2'])
  })

  it('handles three or more categories in first-appearance order', () => {
    const cards: StudyCard[] = [
      makeCard('a1', 'd1', 0, ['tagA']),
      makeCard('a2', 'd1', 0, ['tagA']),
      makeCard('b1', 'd1', 0, ['tagB']),
      makeCard('c1', 'd1', 0, ['tagC']),
      makeCard('c2', 'd1', 0, ['tagC']),
    ]
    const dueIds = cards.map((c) => c.id)
    expect(interleaveByCategory(cards, dueIds)).toEqual(['a1', 'b1', 'c1', 'a2', 'c2'])
  })

  it('only uses the first tag when a card has multiple tags', () => {
    const cards: StudyCard[] = [
      makeCard('a1', 'd1', 0, ['tagA', 'tagZ']),
      makeCard('a2', 'd1', 0, ['tagA', 'tagY']),
      makeCard('b1', 'd1', 0, ['tagB']),
    ]
    const dueIds = cards.map((c) => c.id)
    expect(interleaveByCategory(cards, dueIds)).toEqual(['a1', 'b1', 'a2'])
  })

  it('is a pure function: does not mutate its inputs', () => {
    const cards: StudyCard[] = [
      makeCard('a1', 'd1', 0, ['tagA']),
      makeCard('a2', 'd1', 0, ['tagA']),
      makeCard('b1', 'd1', 0, ['tagB']),
    ]
    const dueIds = cards.map((c) => c.id)
    const cardsSnapshot = [...cards]
    const dueIdsSnapshot = [...dueIds]

    interleaveByCategory(cards, dueIds)

    expect(cards).toEqual(cardsSnapshot)
    expect(dueIds).toEqual(dueIdsSnapshot)
  })

  it('is deterministic across repeated calls with the same input', () => {
    const cards: StudyCard[] = [
      makeCard('a1', 'd1', 0, ['tagA']),
      makeCard('a2', 'd1', 0, ['tagA']),
      makeCard('b1', 'd1', 0, ['tagB']),
      makeCard('b2', 'd1', 0, ['tagB']),
    ]
    const dueIds = cards.map((c) => c.id)
    const first = interleaveByCategory(cards, dueIds)
    const second = interleaveByCategory(cards, dueIds)
    expect(first).toEqual(second)
  })
})

describe('interleaveByCategory (property)', () => {
  it('is always a permutation of dueIds, for any cards and any tag assignment', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 12 }),
        fc.array(fc.string({ minLength: 1, maxLength: 3 }), { maxLength: 3 }),
        (ids, possibleTags) => {
          const cards = ids.map((id, index) =>
            makeCard(id, 'set', 0, possibleTags.length === 0 ? [] : [possibleTags[index % possibleTags.length]!]),
          )
          const dueIds = cards.map((c) => c.id)
          const result = interleaveByCategory(cards, dueIds)
          expect(result).toHaveLength(dueIds.length)
          expect([...result].sort()).toEqual([...dueIds].sort())
        },
      ),
    )
  })
})

describe('countDueCategories', () => {
  it('returns 0 for an empty queue', () => {
    expect(countDueCategories([], [])).toBe(0)
  })

  it('returns 1 when all due cards share a category', () => {
    const cards: StudyCard[] = [makeCard('a1', 'd1', 0, ['tagA']), makeCard('a2', 'd1', 0, ['tagA'])]
    expect(
      countDueCategories(
        cards,
        cards.map((c) => c.id),
      ),
    ).toBe(1)
  })

  it('counts distinct tag/setId categories across the due set', () => {
    const cards: StudyCard[] = [
      makeCard('a1', 'd1', 0, ['tagA']),
      makeCard('b1', 'd1', 0, ['tagB']),
      makeCard('u1', 'setU', 0),
    ]
    expect(
      countDueCategories(
        cards,
        cards.map((c) => c.id),
      ),
    ).toBe(3)
  })
})

describe('reinsertForRelearning', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((id) => id as CardId)

  it('schedules a second appearance RELEARN_GAP (5) cards after its current position', () => {
    // Failed at index 0 ('a'); 9 cards remain after it, more than the gap,
    // so a second 'a' lands exactly 5 cards later — the original (already
    // shown, already passed) slot at index 0 is untouched.
    const result = reinsertForRelearning(ids, 0, ids[0]!)
    expect(result).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'a', 'g', 'h', 'i', 'j'])
  })

  it('does not reinsert immediately after the current position (no massed restudy)', () => {
    const result = reinsertForRelearning(ids, 0, ids[0]!)
    expect(result[1]).not.toBe('a')
  })

  it('clamps the gap to whatever remains when failed near the end of the queue', () => {
    // Only 2 cards remain after index 7 ('h'); gap clamps to 2, landing the
    // second occurrence right at the tail.
    const result = reinsertForRelearning(ids, 7, ids[7]!)
    expect(result).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'h'])
  })

  it('appends at the end when failed on the very last card', () => {
    const result = reinsertForRelearning(ids, 9, ids[9]!)
    expect(result).toEqual([...ids, 'j'])
  })

  it('is pure: does not mutate the input queue', () => {
    const snapshot = [...ids]
    reinsertForRelearning(ids, 0, ids[0]!)
    expect(ids).toEqual(snapshot)
  })
})

describe('reinsertForRelearning (property)', () => {
  it('always grows the queue by exactly one element, for any queue and any valid position', () => {
    fc.assert(
      fc.property(
        fc
          .uniqueArray(fc.string({ minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 15 })
          .chain((queue) =>
            fc.record({ queue: fc.constant(queue), position: fc.integer({ min: 0, max: queue.length - 1 }) }),
          ),
        ({ queue, position }) => {
          const cardIds = queue.map((id) => id as CardId)
          const failedId = cardIds[position]!
          const result = reinsertForRelearning(cardIds, position, failedId)
          expect(result).toHaveLength(cardIds.length + 1)
          // Every original id is still present, plus exactly one extra
          // occurrence of the failed id.
          const counts = new Map<string, number>()
          for (const id of result) counts.set(id, (counts.get(id) ?? 0) + 1)
          for (const id of cardIds) {
            const expected = id === failedId ? 2 : 1
            expect(counts.get(id)).toBe(expected)
          }
        },
      ),
    )
  })
})
