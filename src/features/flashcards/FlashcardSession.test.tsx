import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { NAV_PRESETS } from '../../lib/keybindings'
import { SeshatProvider, useSeshatStore } from '../../lib/store'
import { useKeybindings } from '../../lib/useKeybindings'
import { type StudyCard, cardIdSchema } from '../../types'
import { FlashcardSession } from './FlashcardSession'
import { makeCard, makeHandlers, renderSession, seedStore, sessionElement } from './session-test-helpers'

// @testing-library/react's auto-cleanup relies on a global `afterEach` hook
// (registered via vitest's `globals: true`), which this project's
// vite.config.ts does not enable — so without this, DOM from one test leaks
// into the next and queries start matching multiple elements.
afterEach(() => cleanup())

// jsdom has no pointer capture; the swipe handlers call it on every pointer event.
beforeAll(() => {
  HTMLElement.prototype.setPointerCapture ??= () => undefined
  HTMLElement.prototype.hasPointerCapture ??= () => false
  HTMLElement.prototype.releasePointerCapture ??= () => undefined
})

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

  it('shows the prompt, progress and the control bar, unflipped, before any interaction', () => {
    const card = makeCard()
    seedStore(card)
    renderSession(card)

    expect(screen.getByText('What is the capital of France?')).toBeInTheDocument()
    expect(screen.getByTestId('flashcard-progress')).toHaveTextContent('Card 1 / 3')
    expect(faceElement()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Still learning (←)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Know (→)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo (U)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Shuffle (O)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Options' })).toBeInTheDocument()
    // The old text buttons are gone.
    expect(screen.queryByRole('button', { name: /flip card/i })).not.toBeInTheDocument()
  })

  it('shows the live hint strip with the resolved nav keys', () => {
    const card = makeCard()
    seedStore(card)
    renderSession(card)
    expect(screen.getByText(/Press/)).toHaveTextContent('Press ← to study again or → if you know the answer')
    expect(screen.getByText('Shortcut')).toBeInTheDocument()
  })

  it('flips on card click and on Space, and flips back on a second one', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    renderSession(card)

    await user.click(faceElement())
    expect(faceElement()).toHaveAttribute('aria-pressed', 'true')
    await user.keyboard(' ')
    expect(faceElement()).toHaveAttribute('aria-pressed', 'false')
  })

  it('flips on Enter when the face itself has focus, exactly once', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    renderSession(card)

    faceElement().focus()
    await user.keyboard('{Enter}')
    expect(faceElement()).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not flip on Space while a button has focus (Space activates that button instead)', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    renderSession(card)

    screen.getByRole('button', { name: 'Options' }).focus()
    await user.keyboard(' ')
    expect(faceElement()).toHaveAttribute('aria-pressed', 'false')
  })

  it('grades without flipping first: buttons, nav arrows, and the 1/2 keys', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    const { onGrade } = renderSession(card)

    await user.click(screen.getByRole('button', { name: /^Know/ }))
    await user.click(screen.getByRole('button', { name: /^Still learning/ }))
    await user.keyboard('{ArrowRight}')
    await user.keyboard('{ArrowLeft}')
    await user.keyboard('2')
    await user.keyboard('1')

    expect(onGrade.mock.calls.map(([record]) => record.known)).toEqual([true, false, true, false, true, false])
    expect(faceElement()).toHaveAttribute('aria-pressed', 'false')
  })

  it('records the review and reports the previous scheduling and timestamp for undo', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    const { onGrade } = renderSession(card)

    await user.keyboard('{ArrowRight}')

    expect(onGrade).toHaveBeenCalledTimes(1)
    const record = onGrade.mock.calls[0]![0]
    expect(record).toMatchObject({ cardId: card.id, known: true, previousScheduling: card.scheduling })
    expect(record.reviewedAt).toEqual(expect.any(String))
  })

  it('with progress tracking off, grading advances but touches neither FSRS nor the review log', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    let latest: ReturnType<typeof useSeshatStore> | null = null
    const Probe = () => {
      latest = useSeshatStore()
      return null
    }
    const handlers = makeHandlers()
    render(
      <SeshatProvider>
        <Probe />
        <FlashcardSession
          card={card}
          position={0}
          total={3}
          options={{ trackProgress: false, front: 'term', cardSize: 'small' }}
          shortcutsEnabled
          knownCount={4}
          unknownCount={2}
          canUndo={false}
          shuffled
          onGrade={handlers.onGrade}
          onUndo={handlers.onUndo}
          onToggleShuffle={handlers.onToggleShuffle}
          onOpenOptions={handlers.onOpenOptions}
        />
      </SeshatProvider>,
    )

    await user.click(screen.getByRole('button', { name: /^Know/ }))

    expect(handlers.onGrade).toHaveBeenCalledWith({
      cardId: card.id,
      known: true,
      previousScheduling: null,
      reviewedAt: null,
    })
    expect(latest!.state.reviewLog).toHaveLength(0)
    expect(latest!.state.cards[0]?.scheduling).toEqual(card.scheduling)
  })

  it('shows the definition first when Front is Definition', () => {
    const card = makeCard()
    seedStore(card)
    renderSession(card, { options: { trackProgress: true, front: 'definition', cardSize: 'small' } })
    const faces = document.querySelectorAll('.flip-card-face p')
    expect(faces[0]).toHaveTextContent('Paris')
    expect(faces[1]).toHaveTextContent('What is the capital of France?')
  })

  it('disables Undo unless there is something to undo, and wires the toolbar buttons', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    const handlers = renderSession(card)

    expect(screen.getByTestId('flashcard-undo')).toBeDisabled()
    cleanup()

    const enabled = renderSession(card, { canUndo: true, shuffled: false })
    expect(screen.getByTestId('flashcard-undo')).toBeEnabled()
    expect(screen.getByTestId('flashcard-shuffle')).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByTestId('flashcard-undo'))
    await user.click(screen.getByTestId('flashcard-shuffle'))
    await user.click(screen.getByTestId('flashcard-options'))
    expect(enabled.onUndo).toHaveBeenCalledTimes(1)
    expect(enabled.onToggleShuffle).toHaveBeenCalledTimes(1)
    expect(enabled.onOpenOptions).toHaveBeenCalledTimes(1)
    expect(handlers.onUndo).not.toHaveBeenCalled()
  })
})

describe('FlashcardSession shortcuts and options', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('ignores every shortcut while disabled (a modal is open over the card)', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    const { onGrade } = renderSession(card, { shortcutsEnabled: false })

    await user.keyboard('{ArrowRight}')
    await user.keyboard('1')
    await user.keyboard(' ')
    expect(onGrade).not.toHaveBeenCalled()
    expect(faceElement()).toHaveAttribute('aria-pressed', 'false')
  })

  it('follows the remapped nav keys: WASD grades with A/D and the labels update', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    let setPreset: (() => void) | null = null
    let reset: (() => void) | null = null
    const Probe = () => {
      const { replaceAll } = useKeybindings()
      setPreset = () => replaceAll(NAV_PRESETS.wasd)
      reset = () => replaceAll({})
      return null
    }
    const handlers = makeHandlers()
    const { rerender } = render(
      <>
        <Probe />
        {sessionElement(card, handlers)}
      </>,
    )
    act(() => setPreset!())
    rerender(
      <>
        <Probe />
        {sessionElement(card, handlers)}
      </>,
    )

    expect(screen.getByRole('button', { name: 'Still learning (A)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Know (D)' })).toBeInTheDocument()
    await user.keyboard('d')
    await user.keyboard('a')
    // The arrows no longer grade under WASD.
    await user.keyboard('{ArrowRight}')
    expect(handlers.onGrade.mock.calls.map(([record]) => record.known)).toEqual([true, false])

    act(() => reset!())
  })

  it('resets flipped state when a new card is shown', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    const secondCard: StudyCard = {
      ...card,
      id: cardIdSchema.parse('c2222222-2222-4222-8222-222222222222'),
      prompt: 'What is 2+2?',
      content: { kind: 'short-answer', answer: '4', acceptableAnswers: [], answerImage: null },
    }
    seedStore(card)
    const handlers = makeHandlers()

    const { rerender } = render(sessionElement(card, handlers))
    await user.click(faceElement())
    expect(faceElement()).toHaveAttribute('aria-pressed', 'true')

    rerender(sessionElement(secondCard, handlers))

    expect(screen.getByText('What is 2+2?')).toBeInTheDocument()
    expect(faceElement()).toHaveAttribute('aria-pressed', 'false')
  })
})
