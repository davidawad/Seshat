import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../lib/fsrs'
import { saveState } from '../lib/storage'
import { SeshatProvider } from '../lib/store'
import { type CardId, type SetId, type StudyCard, cardIdSchema, createEmptyAppState, setIdSchema } from '../types'
import { FlashcardsPage } from './Flashcards'

// @testing-library/react's auto-cleanup needs a global `afterEach`, which
// this project doesn't enable (no `test.globals: true` in vite.config.ts) —
// without this, DOM from one test leaks into the next.
afterEach(() => cleanup())

const setId = setIdSchema.parse('a1111111-1111-4111-8111-111111111111')
const otherSetId = setIdSchema.parse('a9999999-9999-4999-8999-999999999999')

const makeCard = (id: CardId, index: number, forSetId: SetId = setId): StudyCard => {
  const now = new Date().toISOString()
  return {
    id,
    setId: forSetId,
    prompt: `Prompt ${index}`,
    content: { kind: 'short-answer', answer: `Answer ${index}`, acceptableAnswers: [] },
    explanation: null,
    sourceRef: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
    scheduling: createInitialScheduling(new Date()),
  }
}

const cardId1 = cardIdSchema.parse('c1111111-1111-4111-8111-111111111111')
const cardId2 = cardIdSchema.parse('c2222222-2222-4222-8222-222222222222')
const cardId3 = cardIdSchema.parse('c3333333-3333-4333-8333-333333333333')

const seedThreeCards = () => {
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
    cards: [makeCard(cardId1, 1), makeCard(cardId2, 2), makeCard(cardId3, 3)],
  })
}

const renderPage = (id: SetId = setId) =>
  render(
    <SeshatProvider>
      <MemoryRouter initialEntries={[`/${id}/flashcards`]}>
        <Routes>
          <Route path=":id/flashcards" element={<FlashcardsPage />} />
        </Routes>
      </MemoryRouter>
    </SeshatProvider>,
  )

/** Flips the current card (if not already flipped) and grades it Know/Don't know. */
const gradeCurrentCard = async (user: UserEvent, known: boolean) => {
  const flipButton = screen.queryByRole('button', { name: /flip card/i })
  if (flipButton !== null) await user.click(flipButton)
  await user.click(screen.getByRole('button', { name: known ? /^know/i : /don.t know/i }))
}

describe('FlashcardsPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shows a not-found message for an invalid set id', () => {
    render(
      <SeshatProvider>
        <MemoryRouter initialEntries={['/not-a-uuid/flashcards']}>
          <Routes>
            <Route path=":id/flashcards" element={<FlashcardsPage />} />
          </Routes>
        </MemoryRouter>
      </SeshatProvider>,
    )
    expect(screen.getByText(/doesn.t point to a valid set/i)).toBeInTheDocument()
  })

  it('shows a not-found message when the set does not exist in the store', () => {
    seedThreeCards()
    render(
      <SeshatProvider>
        <MemoryRouter initialEntries={[`/${otherSetId}/flashcards`]}>
          <Routes>
            <Route path=":id/flashcards" element={<FlashcardsPage />} />
          </Routes>
        </MemoryRouter>
      </SeshatProvider>,
    )
    expect(screen.getByText(/may have been deleted/i)).toBeInTheDocument()
  })

  it('shows an empty-set message when the set has no cards', () => {
    const state = createEmptyAppState()
    saveState({
      ...state,
      sets: [
        {
          id: setId,
          name: 'Empty Set',
          description: '',
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          goalDate: null,
        },
      ],
      cards: [],
    })
    renderPage()
    expect(screen.getByText(/no cards yet/i)).toBeInTheDocument()
  })

  it('defaults to shuffled order and shows the first card of the session', () => {
    seedThreeCards()
    renderPage()
    expect(screen.getByRole('button', { name: 'Shuffled' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Original order' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Card 1 of 3')).toBeInTheDocument()
  })

  it('switching to Original order restarts the deck in that fixed order', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Original order' }))

    expect(screen.getByRole('button', { name: 'Original order' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Shuffled' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Prompt 1')).toBeInTheDocument()
    expect(screen.getByText('Card 1 of 3')).toBeInTheDocument()
  })

  it('tracks known/unknown buckets correctly and scopes "Restudy unknowns" to only those cards', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Original order' }))

    // Prompt 1 -> Know, Prompt 2 -> Don't know, Prompt 3 -> Know
    expect(screen.getByText('Prompt 1')).toBeInTheDocument()
    await gradeCurrentCard(user, true)
    expect(screen.getByText('Prompt 2')).toBeInTheDocument()
    await gradeCurrentCard(user, false)
    expect(screen.getByText('Prompt 3')).toBeInTheDocument()
    await gradeCurrentCard(user, true)

    expect(screen.getByText(/3 cards.*2 known, 1 to review again/)).toBeInTheDocument()
    const restudyButton = screen.getByRole('button', { name: /restudy 1 unknown card/i })
    expect(restudyButton).toBeInTheDocument()

    await user.click(restudyButton)

    // Only the one unknown card (Prompt 2) should be in the restudy session.
    expect(screen.getByText('Prompt 2')).toBeInTheDocument()
    expect(screen.getByText('Card 1 of 1')).toBeInTheDocument()
  })

  it('"Restart full deck" starts a fresh session over every card again', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Original order' }))
    await gradeCurrentCard(user, true)
    await gradeCurrentCard(user, true)
    await gradeCurrentCard(user, true)

    expect(screen.getByText(/3 cards.*3 known, 0 to review again/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /restart full deck/i }))

    expect(screen.getByText('Prompt 1')).toBeInTheDocument()
    expect(screen.getByText('Card 1 of 3')).toBeInTheDocument()
  })

  it('resumes an in-progress session (position + known/unknown stats) after unmount/remount', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    const { unmount } = renderPage()
    await user.click(screen.getByRole('button', { name: 'Original order' }))
    await gradeCurrentCard(user, true) // Prompt 1 -> known
    expect(screen.getByText('Prompt 2')).toBeInTheDocument()

    unmount()
    renderPage()

    // Resumed at Prompt 2, not restarted from Prompt 1.
    expect(screen.getByText('Prompt 2')).toBeInTheDocument()
    expect(screen.getByText('Card 2 of 3')).toBeInTheDocument()

    await gradeCurrentCard(user, false) // Prompt 2 -> unknown
    await gradeCurrentCard(user, true) // Prompt 3 -> known

    // Known/unknown tally carried over across the remount, not reset.
    expect(screen.getByText(/3 cards.*2 known, 1 to review again/)).toBeInTheDocument()
  })

  it('regression: resuming after switching to Original order keeps Original order active, not Shuffled', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    const { unmount } = renderPage()
    await user.click(screen.getByRole('button', { name: 'Original order' }))
    await gradeCurrentCard(user, true)

    unmount()
    renderPage()

    expect(screen.getByRole('button', { name: 'Original order' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Shuffled' })).toHaveAttribute('aria-pressed', 'false')
    // And the resumed order is still the fixed original order, not reshuffled.
    expect(screen.getByText('Prompt 2')).toBeInTheDocument()
  })

  it('does not resume a completed session — a fresh mount after completion starts over', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    const { unmount } = renderPage()
    await user.click(screen.getByRole('button', { name: 'Original order' }))
    await gradeCurrentCard(user, true)
    await gradeCurrentCard(user, true)
    await gradeCurrentCard(user, true)
    expect(screen.getByRole('status')).toHaveTextContent('Session complete')

    unmount()
    renderPage()

    // No stale resume state — fresh session, not stuck on the completion screen.
    expect(screen.queryByText('Session complete')).not.toBeInTheDocument()
    expect(screen.getByText('Card 1 of 3')).toBeInTheDocument()
  })
})
