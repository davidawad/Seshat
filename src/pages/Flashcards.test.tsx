import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../lib/fsrs'
import { saveState } from '../lib/storage'
import { SeshatProvider, useSeshatStore } from '../lib/store'
import { type CardId, type SetId, type StudyCard, cardIdSchema, createEmptyAppState, setIdSchema } from '../types'
import { FlashcardsPage } from './Flashcards'

// @testing-library/react's auto-cleanup needs a global `afterEach`, which
// this project doesn't enable (no `test.globals: true` in vite.config.ts) —
// without this, DOM from one test leaks into the next.
afterEach(() => cleanup())

// jsdom has no native <dialog> modal support; stub the two methods Modal.tsx calls.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

// jsdom has no pointer capture; the swipe handlers call it on every pointer event.
beforeAll(() => {
  HTMLElement.prototype.setPointerCapture ??= () => undefined
  HTMLElement.prototype.hasPointerCapture ??= () => false
  HTMLElement.prototype.releasePointerCapture ??= () => undefined
})

const setId = setIdSchema.parse('a1111111-1111-4111-8111-111111111111')
const otherSetId = setIdSchema.parse('a9999999-9999-4999-8999-999999999999')

const makeCard = (id: CardId, index: number, forSetId: SetId = setId): StudyCard => {
  const now = new Date().toISOString()
  return {
    id,
    setId: forSetId,
    prompt: `Prompt ${index}`,
    promptImage: null,
    content: { kind: 'short-answer', answer: `Answer ${index}`, acceptableAnswers: [], answerImage: null },
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

/** Probe so tests can read the live store (review log, scheduling, settings). */
let latestStore: ReturnType<typeof useSeshatStore> | null = null
const StoreProbe = () => {
  latestStore = useSeshatStore()
  return null
}
const store = () => {
  if (latestStore === null) throw new Error('store probe not mounted')
  return latestStore
}

const renderPage = (id: SetId = setId) =>
  render(
    <SeshatProvider>
      <StoreProbe />
      <MemoryRouter initialEntries={[`/${id}/flashcards`]}>
        <Routes>
          <Route path=":id/flashcards" element={<FlashcardsPage />} />
        </Routes>
      </MemoryRouter>
    </SeshatProvider>,
  )

/** Grades the current card straight from the control bar (no flip needed). */
const gradeCurrentCard = async (user: UserEvent, known: boolean) => {
  await user.click(screen.getByRole('button', { name: known ? /^know/i : /^still learning/i }))
}

/** Switches the default shuffled session to the fixed original order (the toggle restarts it). */
const useOriginalOrder = async (user: UserEvent) => {
  await user.click(screen.getByRole('button', { name: /^shuffle/i }))
}

const progress = () => screen.getByTestId('flashcard-progress')
const optionsDialog = () => screen.getByRole('dialog', { name: 'Options' })
const cardScheduling = (id: CardId) => store().state.cards.find((card) => card.id === id)!.scheduling

describe('FlashcardsPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shows a not-found message for an invalid set id', () => {
    renderPage('not-a-uuid' as SetId)
    expect(screen.getByText(/doesn.t point to a valid set/i)).toBeInTheDocument()
  })

  it('shows a not-found message when the set does not exist in the store', () => {
    seedThreeCards()
    renderPage(otherSetId)
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
    expect(screen.getByRole('heading', { level: 1, name: 'Empty Set' })).toBeInTheDocument()
  })

  it('header is a plain Back link to the set plus the bare set name as the h1', () => {
    seedThreeCards()
    renderPage()
    expect(screen.getByRole('link', { name: 'Back to Test Set' })).toHaveAttribute('href', `/sets/${setId}`)
    expect(screen.getByRole('heading', { level: 1, name: 'Test Set' })).toBeInTheDocument()
  })

  it('defaults to shuffled order and shows the first card of the session', () => {
    seedThreeCards()
    renderPage()
    expect(screen.getByRole('button', { name: /^shuffle/i })).toHaveAttribute('aria-pressed', 'true')
    expect(progress()).toHaveTextContent('Card 1 / 3')
  })

  it('the shuffle toggle restarts the deck in the original order and back', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    renderPage()

    await useOriginalOrder(user)

    expect(screen.getByRole('button', { name: /^shuffle/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Prompt 1')).toBeInTheDocument()
    expect(progress()).toHaveTextContent('Card 1 / 3')

    await user.click(screen.getByRole('button', { name: /^shuffle/i }))
    expect(screen.getByRole('button', { name: /^shuffle/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('the O key toggles shuffle', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    renderPage()
    await user.keyboard('o')
    expect(screen.getByRole('button', { name: /^shuffle/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('tracks known/unknown buckets correctly and scopes "Restudy unknowns" to only those cards', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    renderPage()
    await useOriginalOrder(user)

    // Prompt 1 -> Know, Prompt 2 -> Still learning, Prompt 3 -> Know
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
    expect(progress()).toHaveTextContent('Card 1 / 1')
  })

  it('"Restart full deck" starts a fresh session over every card again', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    renderPage()
    await useOriginalOrder(user)
    await gradeCurrentCard(user, true)
    await gradeCurrentCard(user, true)
    await gradeCurrentCard(user, true)

    expect(screen.getByText(/3 cards.*3 known, 0 to review again/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /restart full deck/i }))

    expect(screen.getByText('Prompt 1')).toBeInTheDocument()
    expect(progress()).toHaveTextContent('Card 1 / 3')
  })

  it('resumes an in-progress session (position + known/unknown stats) after unmount/remount', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    const { unmount } = renderPage()
    await useOriginalOrder(user)
    await gradeCurrentCard(user, true) // Prompt 1 -> known
    expect(screen.getByText('Prompt 2')).toBeInTheDocument()

    unmount()
    renderPage()

    // Resumed at Prompt 2, not restarted from Prompt 1.
    expect(screen.getByText('Prompt 2')).toBeInTheDocument()
    expect(progress()).toHaveTextContent('Card 2 / 3')
    // A resumed session has nothing on its undo stack.
    expect(screen.getByTestId('flashcard-undo')).toBeDisabled()

    await gradeCurrentCard(user, false) // Prompt 2 -> unknown
    await gradeCurrentCard(user, true) // Prompt 3 -> known

    // Known/unknown tally carried over across the remount, not reset.
    expect(screen.getByText(/3 cards.*2 known, 1 to review again/)).toBeInTheDocument()
  })

  it('regression: resuming after switching to Original order keeps Original order active, not Shuffled', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    const { unmount } = renderPage()
    await useOriginalOrder(user)
    await gradeCurrentCard(user, true)

    unmount()
    renderPage()

    expect(screen.getByRole('button', { name: /^shuffle/i })).toHaveAttribute('aria-pressed', 'false')
    // And the resumed order is still the fixed original order, not reshuffled.
    expect(screen.getByText('Prompt 2')).toBeInTheDocument()
  })

  it('does not resume a completed session — a fresh mount after completion starts over', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    const { unmount } = renderPage()
    await useOriginalOrder(user)
    await gradeCurrentCard(user, true)
    await gradeCurrentCard(user, true)
    await gradeCurrentCard(user, true)
    expect(screen.getByText('Session complete')).toBeInTheDocument()

    unmount()
    renderPage()

    // No stale resume state — fresh session, not stuck on the completion screen.
    expect(screen.queryByText('Session complete')).not.toBeInTheDocument()
    expect(progress()).toHaveTextContent('Card 1 / 3')
  })

  it('grades with the nav keys without flipping and announces the result', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    renderPage()
    await useOriginalOrder(user)

    await user.keyboard('{ArrowRight}')
    expect(screen.getByTestId('flashcards-announcer')).toHaveTextContent('Marked as known. Card 2 of 3.')
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByTestId('flashcards-announcer')).toHaveTextContent('Marked as still learning. Card 3 of 3.')
  })
})

describe('FlashcardsPage undo', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('is disabled at the start and does nothing on the U key', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    renderPage()
    await useOriginalOrder(user)
    expect(screen.getByTestId('flashcard-undo')).toBeDisabled()
    await user.keyboard('u')
    expect(progress()).toHaveTextContent('Card 1 / 3')
  })

  it('grade then undo restores the card scheduling, the review log and the position', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    renderPage()
    await useOriginalOrder(user)
    const before = cardScheduling(cardId1)

    await gradeCurrentCard(user, true)
    expect(store().state.reviewLog).toHaveLength(1)
    expect(cardScheduling(cardId1)).not.toEqual(before)
    expect(progress()).toHaveTextContent('Card 2 / 3')
    expect(screen.getByTestId('flashcard-undo')).toBeEnabled()

    await user.click(screen.getByTestId('flashcard-undo'))

    expect(store().state.reviewLog).toHaveLength(0)
    expect(cardScheduling(cardId1)).toEqual(before)
    expect(progress()).toHaveTextContent('Card 1 / 3')
    expect(screen.getByText('Prompt 1')).toBeInTheDocument()
    expect(screen.getByTestId('flashcard-undo')).toBeDisabled()
    expect(screen.getByTestId('flashcards-announcer')).toHaveTextContent('Undid last answer. Card 1 of 3.')
  })

  it('steps back repeatedly and reverses the known/unknown counters', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    renderPage()
    await useOriginalOrder(user)

    await gradeCurrentCard(user, true)
    await gradeCurrentCard(user, false)
    await gradeCurrentCard(user, true)
    expect(store().state.reviewLog).toHaveLength(3)

    // Done: undo is still reachable from the completion screen.
    await user.click(screen.getByRole('button', { name: 'Undo last answer' }))
    expect(screen.getByText('Prompt 3')).toBeInTheDocument()
    await user.keyboard('u')
    expect(screen.getByText('Prompt 2')).toBeInTheDocument()
    expect(store().state.reviewLog).toHaveLength(1)
    await user.click(screen.getByTestId('flashcard-undo'))
    expect(screen.getByText('Prompt 1')).toBeInTheDocument()
    expect(store().state.reviewLog).toHaveLength(0)
    expect(screen.getByTestId('flashcard-undo')).toBeDisabled()

    // Counters were reversed too: regrading everything known leaves zero unknown.
    await gradeCurrentCard(user, true)
    await gradeCurrentCard(user, true)
    await gradeCurrentCard(user, true)
    expect(screen.getByText(/3 cards.*3 known, 0 to review again/)).toBeInTheDocument()
  })

  it('undoing an untracked grade only steps back (there is no FSRS change to roll back)', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    renderPage()
    await useOriginalOrder(user)
    await user.click(screen.getByTestId('flashcard-options'))
    await user.click(within(optionsDialog()).getByRole('switch', { name: 'Track progress' }))
    await user.click(within(optionsDialog()).getByRole('button', { name: 'Close' }))

    await gradeCurrentCard(user, true)
    expect(store().state.reviewLog).toHaveLength(0)
    await user.click(screen.getByTestId('flashcard-undo'))
    expect(progress()).toHaveTextContent('Card 1 / 3')
    expect(store().state.reviewLog).toHaveLength(0)
  })
})

describe('FlashcardsPage options modal', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('opens from the gear with a switch defaulting on, the Front select, and Restart', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Options' }))

    const dialog = optionsDialog()
    expect(within(dialog).getByRole('switch', { name: 'Track progress' })).toHaveAttribute('aria-checked', 'true')
    expect(within(dialog).getByText(/Sort your flashcards to keep track/)).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Front')).toHaveValue('term')
    expect(within(dialog).getByRole('button', { name: 'Restart flashcards' })).toBeInTheDocument()
    // Keyboard shortcuts live in the footer modal, not here.
    expect(within(dialog).queryByText(/shortcut/i)).not.toBeInTheDocument()
  })

  it('Front: Definition shows the definition first and persists in Settings', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    renderPage()
    await useOriginalOrder(user)
    await user.click(screen.getByTestId('flashcard-options'))
    await user.selectOptions(within(optionsDialog()).getByLabelText('Front'), 'definition')

    expect(store().state.settings.flashcardsFront).toBe('definition')
    const faces = document.querySelectorAll('.flip-card-face > p:not(.card-tip)')
    expect(faces[0]).toHaveTextContent('Answer 1')
    expect(faces[1]).toHaveTextContent('Prompt 1')
  })

  it('turning Track progress off persists it and grading no longer touches FSRS or the log', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    renderPage()
    await useOriginalOrder(user)
    const before = cardScheduling(cardId1)
    await user.click(screen.getByTestId('flashcard-options'))
    await user.click(within(optionsDialog()).getByRole('switch', { name: 'Track progress' }))
    expect(store().state.settings.flashcardsTrackProgress).toBe(false)
    expect(within(optionsDialog()).getByRole('switch', { name: 'Track progress' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
    await user.click(within(optionsDialog()).getByRole('button', { name: 'Close' }))

    await gradeCurrentCard(user, true)

    expect(progress()).toHaveTextContent('Card 2 / 3')
    expect(store().state.reviewLog).toHaveLength(0)
    expect(cardScheduling(cardId1)).toEqual(before)
  })

  it('does not grade or flip the card behind it while open', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    renderPage()
    await useOriginalOrder(user)
    await user.click(screen.getByTestId('flashcard-options'))

    await user.keyboard('{ArrowRight}')
    await user.keyboard(' ')
    await user.keyboard('u')

    expect(progress()).toHaveTextContent('Card 1 / 3')
    expect(screen.getByRole('button', { name: /question shown/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('Restart flashcards starts over from card 1 with a clean undo state and closes the modal', async () => {
    const user = userEvent.setup()
    seedThreeCards()
    renderPage()
    await useOriginalOrder(user)
    await gradeCurrentCard(user, true)
    await gradeCurrentCard(user, false)
    expect(progress()).toHaveTextContent('Card 3 / 3')

    await user.click(screen.getByTestId('flashcard-options'))
    await user.click(within(optionsDialog()).getByRole('button', { name: 'Restart flashcards' }))

    expect(progress()).toHaveTextContent('Card 1 / 3')
    expect(screen.getByText('Prompt 1')).toBeInTheDocument()
    expect(screen.getByTestId('flashcard-undo')).toBeDisabled()
    expect(screen.queryByRole('dialog', { name: 'Options' })).not.toBeInTheDocument()
  })
})
