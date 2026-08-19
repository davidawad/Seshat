import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { CardId, SchedulingState, SetId, StudyCard } from '../../types'
import { SetMasterySummary } from './SetMasterySummary'

// @testing-library/react's auto-cleanup needs a global `afterEach`, which
// this project doesn't enable (no `test.globals: true` in vite.config.ts) —
// without this, DOM from one test leaks into the next.
afterEach(() => cleanup())

const setId = 'set-1' as SetId

const scheduling = (overrides: Partial<SchedulingState>): SchedulingState => ({
  due: new Date().toISOString(),
  stability: 1,
  difficulty: 1,
  scheduledDays: 1,
  learningSteps: 0,
  reps: 0,
  lapses: 0,
  state: 'New',
  lastReview: null,
  ...overrides,
})

const buildCard = (id: string, overrides: Partial<SchedulingState>): StudyCard => {
  const now = new Date().toISOString()
  return {
    id: id as CardId,
    setId,
    prompt: `Prompt ${id}`,
    content: { kind: 'short-answer', answer: 'Answer', acceptableAnswers: [] },
    explanation: null,
    sourceRef: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
    scheduling: scheduling(overrides),
  }
}

const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

describe('SetMasterySummary', () => {
  it('a freshly created set shows every card under "new" and never also under "due"', () => {
    const cards = [
      buildCard('c1', { state: 'New', due: YESTERDAY }),
      buildCard('c2', { state: 'New', due: YESTERDAY }),
      buildCard('c3', { state: 'New', due: YESTERDAY }),
    ]

    render(<SetMasterySummary cards={cards} />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('3 cards')
    expect(status).toHaveTextContent('3 new')
    expect(status).not.toHaveTextContent('due for review')
  })

  it('counts a never-studied card only as new and a previously-studied overdue card only as due, without double-counting', () => {
    const cards = [
      buildCard('c1', { state: 'New', due: YESTERDAY }),
      buildCard('c2', { state: 'Review', due: YESTERDAY, lastReview: YESTERDAY }),
      buildCard('c3', { state: 'Review', due: TOMORROW, lastReview: YESTERDAY }),
    ]

    render(<SetMasterySummary cards={cards} />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('3 cards')
    expect(status).toHaveTextContent('1 due for review')
    expect(status).toHaveTextContent('1 new')
  })

  it('shows only the card count when there are no cards', () => {
    render(<SetMasterySummary cards={[]} />)
    expect(screen.getByRole('status')).toHaveTextContent('0 cards')
  })
})
