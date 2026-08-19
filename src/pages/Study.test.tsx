import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../lib/fsrs'
import { saveState } from '../lib/storage'
import { SeshatProvider, useSeshatStore } from '../lib/store'
import { type CardId, type SetId, type StudyCard, cardIdSchema, createEmptyAppState, setIdSchema } from '../types'
import { StudyPage } from './Study'

// @testing-library/react's auto-cleanup needs a global `afterEach`, which
// this project doesn't enable (no `test.globals: true` in vite.config.ts) —
// without this, DOM from one test leaks into the next.
afterEach(() => cleanup())

const setId = setIdSchema.parse('a1111111-1111-4111-8111-111111111111')
const otherSetId = setIdSchema.parse('a9999999-9999-4999-8999-999999999999')

const cardId1 = cardIdSchema.parse('c1111111-1111-4111-8111-111111111111')
const cardId2 = cardIdSchema.parse('c2222222-2222-4222-8222-222222222222')
const cardId3 = cardIdSchema.parse('c3333333-3333-4333-8333-333333333333')

/** A due card, `dueOffsetSeconds` apart so `selectDueQueue`'s due-ascending sort is deterministic. */
const makeDueCard = (id: CardId, prompt: string, answer: string, dueOffsetSeconds: number): StudyCard => {
  const now = new Date().toISOString()
  const baseDue = new Date('2020-01-01T00:00:00.000Z')
  return {
    id,
    setId,
    prompt,
    content: { kind: 'short-answer', answer, acceptableAnswers: [] },
    explanation: null,
    sourceRef: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
    scheduling: {
      ...createInitialScheduling(new Date()),
      due: new Date(baseDue.getTime() + dueOffsetSeconds * 1000).toISOString(),
    },
  }
}

const seedCards = (cards: readonly StudyCard[]) => {
  const state = createEmptyAppState()
  saveState({
    ...state,
    sets: [
      {
        id: setId,
        name: 'Test Set',
        description: '',
        tags: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        goalDate: null,
      },
    ],
    cards: [...cards],
  })
}

/** Test-only harness that shares the same store context as the page under test, exposing a delete button. */
const DeleteCardButton = ({ cardId }: { readonly cardId: CardId }) => {
  const { deleteCard } = useSeshatStore()
  return (
    <button type="button" onClick={() => deleteCard(cardId)}>
      Delete card (test harness)
    </button>
  )
}

const renderPage = (id: SetId = setId, withDeleteHarnessFor: CardId | null = null) =>
  render(
    <SeshatProvider>
      {withDeleteHarnessFor !== null && <DeleteCardButton cardId={withDeleteHarnessFor} />}
      <MemoryRouter initialEntries={[`/${id}/study`]}>
        <Routes>
          <Route path=":id/study" element={<StudyPage />} />
        </Routes>
      </MemoryRouter>
    </SeshatProvider>,
  )

/** Answers the current card's short-answer input, continues, picks a confidence, then grades. */
const answerAndGrade = async (
  user: UserEvent,
  response: string,
  confidence: 'Guessed' | 'Unsure' | 'Sure',
  grade: RegExp,
) => {
  await user.type(screen.getByLabelText(/your answer/i), response)
  await user.click(screen.getByRole('button', { name: /continue/i }))
  await user.click(screen.getByRole('button', { name: confidence }))
  await user.click(screen.getByRole('button', { name: grade }))
}

describe('StudyPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shows a not-found message for an invalid set id', () => {
    render(
      <SeshatProvider>
        <MemoryRouter initialEntries={['/not-a-uuid/study']}>
          <Routes>
            <Route path=":id/study" element={<StudyPage />} />
          </Routes>
        </MemoryRouter>
      </SeshatProvider>,
    )
    expect(screen.getByText('Set not found')).toBeInTheDocument()
  })

  it('shows a not-found message when the set does not exist in the store', () => {
    seedCards([makeDueCard(cardId1, 'Prompt 1', 'Answer 1', 0)])
    renderPage(otherSetId)
    expect(screen.getByText('This set may have been deleted.')).toBeInTheDocument()
  })

  it('shows "nothing due" when the set has cards but none are due yet', () => {
    const state = createEmptyAppState()
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    saveState({
      ...state,
      sets: [
        {
          id: setId,
          name: 'Test Set',
          description: '',
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          goalDate: null,
        },
      ],
      cards: [
        {
          ...makeDueCard(cardId1, 'Prompt 1', 'Answer 1', 0),
          scheduling: { ...createInitialScheduling(new Date()), due: farFuture },
        },
      ],
    })
    renderPage()
    expect(screen.getByRole('status')).toHaveTextContent(/nothing due right now/i)
    expect(screen.getByRole('status')).toHaveTextContent('1 card scheduled for later')
  })

  it('renders the first due card with correct position/total and a progress bar', () => {
    seedCards([makeDueCard(cardId1, 'Prompt 1', 'Answer 1', 0), makeDueCard(cardId2, 'Prompt 2', 'Answer 2', 1)])
    renderPage()
    expect(screen.getByText('Prompt 1')).toBeInTheDocument()
    expect(screen.getByText('Card 1 of 2')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '1')
    expect(screen.getByRole('progressbar')).toHaveAttribute('max', '2')
  })

  it('renders a real end-of-session summary: accuracy percentage and grade-breakdown counts', async () => {
    const user = userEvent.setup()
    seedCards([
      makeDueCard(cardId1, 'Prompt 1', 'Paris', 0),
      makeDueCard(cardId2, 'Prompt 2', 'London', 1),
      makeDueCard(cardId3, 'Prompt 3', 'Tokyo', 2),
    ])
    renderPage()

    // Card 1: correct, graded Good.
    await answerAndGrade(user, 'Paris', 'Sure', /^good/i)
    // Card 2: incorrect, graded Hard (deliberately not "Again" — that grade
    // reinserts the card later in the same session via reinsertForRelearning,
    // which would grow the queue past 3 and complicate this assertion; that
    // requeue behavior is covered at the pure-logic level in dueQueue.test.ts).
    await answerAndGrade(user, 'wrong', 'Guessed', /^hard/i)
    // Card 3: correct, graded Easy.
    await answerAndGrade(user, 'Tokyo', 'Sure', /^easy/i)

    const summary = screen.getByRole('status')
    expect(summary).toHaveTextContent('Session complete')
    expect(within(summary).getByText('Cards reviewed').nextElementSibling).toHaveTextContent('3')
    expect(within(summary).getByText('Accuracy').nextElementSibling).toHaveTextContent('67%')
    expect(within(summary).getByText('Again').nextElementSibling).toHaveTextContent('0')
    expect(within(summary).getByText('Hard').nextElementSibling).toHaveTextContent('1')
    expect(within(summary).getByText('Good').nextElementSibling).toHaveTextContent('1')
    expect(within(summary).getByText('Easy').nextElementSibling).toHaveTextContent('1')
  })

  it('resumes an in-progress session (position + stats) after unmount/remount', async () => {
    const user = userEvent.setup()
    seedCards([
      makeDueCard(cardId1, 'Prompt 1', 'Paris', 0),
      makeDueCard(cardId2, 'Prompt 2', 'London', 1),
      makeDueCard(cardId3, 'Prompt 3', 'Tokyo', 2),
    ])
    const { unmount } = renderPage()

    await answerAndGrade(user, 'Paris', 'Sure', /^good/i)
    expect(screen.getByText('Prompt 2')).toBeInTheDocument()

    unmount()
    renderPage()

    // Resumed directly at card 2, not restarted at card 1.
    expect(screen.getByText('Prompt 2')).toBeInTheDocument()
    expect(screen.getByText('Card 2 of 3')).toBeInTheDocument()

    await answerAndGrade(user, 'London', 'Sure', /^good/i)
    await answerAndGrade(user, 'Tokyo', 'Sure', /^good/i)

    // The pre-resume review (card 1) is still counted in the final tally.
    const summary = screen.getByRole('status')
    expect(within(summary).getByText('Cards reviewed').nextElementSibling).toHaveTextContent('3')
  })

  it('does not resume a completed session — a fresh mount after completion does not show the stale summary', async () => {
    const user = userEvent.setup()
    seedCards([makeDueCard(cardId1, 'Prompt 1', 'Paris', 0)])
    const { unmount } = renderPage()

    await answerAndGrade(user, 'Paris', 'Sure', /^good/i)
    expect(screen.getByRole('status')).toHaveTextContent('Session complete')

    unmount()
    renderPage()

    // No stale resume state parked past the end of a since-cleared queue.
    expect(screen.queryByText('Session complete')).not.toBeInTheDocument()
  })

  it('SkipRemovedCard: a due card deleted mid-session is skipped, and the skip is persisted (resume lands past it, not back on it)', async () => {
    const user = userEvent.setup()
    seedCards([makeDueCard(cardId1, 'Prompt 1', 'Paris', 0), makeDueCard(cardId2, 'Prompt 2', 'London', 1)])
    const { unmount } = renderPage(setId, cardId1)

    expect(screen.getByText('Prompt 1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /delete card \(test harness\)/i }))

    // Card 1 vanished out from under the session; it should auto-skip to card 2.
    expect(await screen.findByText('Prompt 2')).toBeInTheDocument()
    expect(screen.getByText('Card 2 of 2')).toBeInTheDocument()

    unmount()
    renderPage()

    // Resume correctly landed past the deleted card, not back on it.
    expect(screen.getByText('Prompt 2')).toBeInTheDocument()
    expect(screen.getByText('Card 2 of 2')).toBeInTheDocument()
  })

  it('SkipRemovedCard: deleting the only due card skips straight to a (0-reviewed) summary and does not leave stale resume state', async () => {
    const user = userEvent.setup()
    seedCards([makeDueCard(cardId1, 'Prompt 1', 'Paris', 0)])
    const { unmount } = renderPage(setId, cardId1)

    expect(screen.getByText('Prompt 1')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /delete card \(test harness\)/i }))

    const summary = await screen.findByRole('status')
    expect(summary).toHaveTextContent('Session complete')
    expect(within(summary).getByText('Cards reviewed').nextElementSibling).toHaveTextContent('0')

    unmount()
    renderPage()

    // Fresh mount doesn't try to resume a session parked past its (now-cleared) queue.
    expect(screen.queryByText('Session complete')).not.toBeInTheDocument()
  })
})
