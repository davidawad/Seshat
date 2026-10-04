import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TESTIDS } from '../../../lib/testids'
import type { CardId, SetId, StudyCard } from '../../../types'
import { BlocksSession } from './BlocksSession'

const setId = 'set-layout' as SetId

const makeCard = (i: number): StudyCard =>
  ({
    id: `card-layout-${i}` as CardId,
    setId,
    prompt: `Term ${i}`,
    promptImage: null,
    content: { kind: 'short-answer', answer: `Definition ${i}`, acceptableAnswers: [], answerImage: null },
    explanation: null,
    sourceRef: null,
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    scheduling: {
      due: '2026-01-01T00:00:00.000Z',
      stability: 0,
      difficulty: 0,
      scheduledDays: 0,
      learningSteps: 0,
      reps: 0,
      lapses: 0,
      state: 'New',
      lastReview: null,
    },
  }) as StudyCard

describe('BlocksSession layout', () => {
  it('puts the block grid before the question panel so reading and tab order go blocks then question', () => {
    render(<BlocksSession setId={setId} cards={Array.from({ length: 6 }, (_, i) => makeCard(i))} />)
    const board = screen.getByTestId(TESTIDS.blocksBoard)
    expect(board.children).toHaveLength(2)
    const [grid, panel] = Array.from(board.children)
    expect(grid?.classList.contains('blocks-grid')).toBe(true)
    expect(panel?.classList.contains('blocks-panel')).toBe(true)
    expect(panel?.contains(screen.getAllByTestId(TESTIDS.blocksOption)[0] ?? null)).toBe(true)
    expect(grid?.querySelector('button')).toBeNull()
  })
})
