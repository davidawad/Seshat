import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import { saveState } from '../../lib/storage'
import { SeshatProvider } from '../../lib/store'
import { type StudyCard, cardIdSchema, createEmptyAppState, setIdSchema } from '../../types'
import { FlashcardSession } from './FlashcardSession'

// @testing-library/react's auto-cleanup relies on a global `afterEach` hook
// (registered via vitest's `globals: true`), which this project's
// vite.config.ts does not enable — so without this, DOM from one test leaks
// into the next and queries start matching multiple elements.
afterEach(() => cleanup())

const setId = setIdSchema.parse('a1111111-1111-4111-8111-111111111111')
const cardId = cardIdSchema.parse('c1111111-1111-4111-8111-111111111111')

const makeCard = (): StudyCard => {
  const now = new Date().toISOString()
  return {
    id: cardId,
    setId,
    prompt: 'What is the capital of France?',
    content: { kind: 'short-answer', answer: 'Paris', acceptableAnswers: [] },
    explanation: null,
    sourceRef: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
    scheduling: createInitialScheduling(new Date()),
  }
}

const seedStore = (card: StudyCard) => {
  const state = createEmptyAppState()
  saveState({
    ...state,
    sets: [
      {
        id: setId,
        name: 'Test Set',
        description: '',
        tags: [],
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
        goalDate: null,
      },
    ],
    cards: [card],
  })
}

const renderSession = (card: StudyCard, onAdvance = vi.fn<(known: boolean) => void>()) => {
  render(
    <SeshatProvider>
      <FlashcardSession card={card} position={0} total={3} onAdvance={onAdvance} />
    </SeshatProvider>,
  )
  return onAdvance
}

/**
 * The flip card face renders both front and back text at all times (a
 * CSS-only 3D flip via the `is-flipped` class — jsdom doesn't run layout, so
 * both faces are always "present" in the DOM). The real signal for
 * flipped-vs-not is `aria-pressed` on the face, not text presence/absence.
 */
const faceElement = () => screen.getByRole('button', { name: /question shown|answer revealed/i })

describe('FlashcardSession', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shows the prompt and position/total, unflipped, before any interaction', () => {
    const card = makeCard()
    seedStore(card)
    renderSession(card)

    expect(screen.getByText('What is the capital of France?')).toBeInTheDocument()
    expect(screen.getByText('Card 1 of 3')).toBeInTheDocument()
    expect(faceElement()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /flip card/i })).toBeInTheDocument()
    // Grade buttons only exist once flipped (a real conditional render, not CSS).
    expect(screen.queryByRole('button', { name: /don.t know/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^know/i })).not.toBeInTheDocument()
  })

  it('flips to reveal grade buttons and marks the face as pressed', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    renderSession(card)

    await user.click(screen.getByRole('button', { name: /flip card/i }))

    expect(faceElement()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /don.t know/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^know/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /flip card/i })).not.toBeInTheDocument()
  })

  it('flips on Space key and grades with the "2" (Know) key', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    const onAdvance = renderSession(card)

    await user.keyboard(' ')
    expect(faceElement()).toHaveAttribute('aria-pressed', 'true')

    await user.keyboard('2')
    expect(onAdvance).toHaveBeenCalledWith(true)
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })

  it('grades "Don\'t know" with the "1" key after flipping', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    const onAdvance = renderSession(card)

    await user.keyboard(' ')
    await user.keyboard('1')
    expect(onAdvance).toHaveBeenCalledWith(false)
  })

  it("grades via the Know/Don't know buttons after clicking to flip", async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    const onAdvance = renderSession(card)

    await user.click(screen.getByRole('button', { name: /flip card/i }))
    await user.click(screen.getByRole('button', { name: /^know/i }))

    expect(onAdvance).toHaveBeenCalledTimes(1)
    expect(onAdvance).toHaveBeenCalledWith(true)
  })

  it('does not flip or grade on 1/2 keys before the card has been flipped', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    const onAdvance = renderSession(card)

    await user.keyboard('2')
    expect(faceElement()).toHaveAttribute('aria-pressed', 'false')
    expect(onAdvance).not.toHaveBeenCalled()
  })

  it('renders the keyboard shortcut legend', () => {
    const card = makeCard()
    seedStore(card)
    renderSession(card)
    expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument()
  })

  it('resets flipped state when a new card is shown (position/card change)', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    const secondCard: StudyCard = {
      ...card,
      id: cardIdSchema.parse('c2222222-2222-4222-8222-222222222222'),
      prompt: 'What is 2+2?',
      content: { kind: 'short-answer', answer: '4', acceptableAnswers: [] },
    }
    seedStore(card)
    const onAdvance = vi.fn<(known: boolean) => void>()

    const { rerender } = render(
      <SeshatProvider>
        <FlashcardSession card={card} position={0} total={2} onAdvance={onAdvance} />
      </SeshatProvider>,
    )
    await user.click(screen.getByRole('button', { name: /flip card/i }))
    expect(faceElement()).toHaveAttribute('aria-pressed', 'true')

    rerender(
      <SeshatProvider>
        <FlashcardSession card={secondCard} position={1} total={2} onAdvance={onAdvance} />
      </SeshatProvider>,
    )

    expect(screen.getByText('What is 2+2?')).toBeInTheDocument()
    expect(faceElement()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /flip card/i })).toBeInTheDocument()
  })
})
