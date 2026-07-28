import { describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import type { CardId, DeckId, StudyCard } from '../../types'
import { selectDueQueue } from './dueQueue'

const now = new Date('2026-01-10T00:00:00.000Z')

const makeCard = (id: string, deckId: string, dueOffsetMs: number): StudyCard => ({
  id: id as CardId,
  deckId: deckId as DeckId,
  prompt: 'prompt',
  content: { kind: 'short-answer', answer: 'answer', acceptableAnswers: [] },
  explanation: null,
  sourceRef: null,
  tags: [],
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  scheduling: { ...createInitialScheduling(now), due: new Date(now.getTime() + dueOffsetMs).toISOString() },
})

describe('selectDueQueue', () => {
  it('includes only due cards, oldest-due-first', () => {
    const cards: StudyCard[] = [makeCard('c1', 'd1', 0), makeCard('c2', 'd1', -60_000), makeCard('c3', 'd1', 60_000)]
    expect(selectDueQueue(cards, null, now)).toEqual(['c2', 'c1'])
  })

  it('filters to a single deck when deckId is given', () => {
    const cards: StudyCard[] = [makeCard('c1', 'd1', -1000), makeCard('c2', 'd2', -1000)]
    expect(selectDueQueue(cards, 'd1' as DeckId, now)).toEqual(['c1'])
  })

  it('returns an empty queue when nothing is due', () => {
    const cards: StudyCard[] = [makeCard('c1', 'd1', 60_000)]
    expect(selectDueQueue(cards, null, now)).toEqual([])
  })
})
