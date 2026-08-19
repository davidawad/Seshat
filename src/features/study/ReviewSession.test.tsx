import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import { saveState } from '../../lib/storage'
import { SeshatProvider } from '../../lib/store'
import { type StudyCard, cardIdSchema, createEmptyAppState, setIdSchema } from '../../types'
import { ReviewSession } from './ReviewSession'

// @testing-library/react's auto-cleanup needs a global `afterEach`, which
// this project doesn't enable (no `test.globals: true` in vite.config.ts) —
// without this, DOM from one test leaks into the next.
afterEach(() => cleanup())

const setId = setIdSchema.parse('a1111111-1111-4111-8111-111111111111')
const cardId = cardIdSchema.parse('c1111111-1111-4111-8111-111111111111')

const makeCard = (overrides: Partial<StudyCard> = {}): StudyCard => {
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
    ...overrides,
  }
}

const seedStore = (
  card: StudyCard,
  settingsPatch: Partial<ReturnType<typeof createEmptyAppState>['settings']> = {},
) => {
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
    settings: { ...state.settings, ...settingsPatch },
  })
}

const renderSession = (
  card: StudyCard,
  onAdvance = vi.fn<(grade: string, correct: boolean) => void>(),
  position = 0,
  total = 5,
) => {
  render(
    <SeshatProvider>
      <ReviewSession card={card} position={position} total={total} onAdvance={onAdvance} />
    </SeshatProvider>,
  )
  return onAdvance
}

describe('ReviewSession', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shows the prompt, the answer input, and progress; Continue is disabled until an answer is entered', () => {
    const card = makeCard()
    seedStore(card)
    renderSession(card, vi.fn(), 2, 5)

    expect(screen.getByText('What is the capital of France?')).toBeInTheDocument()
    expect(screen.getByText('Card 3 of 5')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /study session progress/i })).toHaveAttribute('value', '3')
    expect(screen.getByRole('progressbar', { name: /study session progress/i })).toHaveAttribute('max', '5')
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
  })

  it('renders the keyboard shortcut legend', () => {
    const card = makeCard()
    seedStore(card)
    renderSession(card)
    expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument()
  })
})

describe('ReviewSession answer -> confidence -> reveal flow', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('enables Continue once an answer is typed, then advances to the confidence step', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    renderSession(card)

    await user.type(screen.getByLabelText(/your answer/i), 'Paris')
    expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(screen.getByText(/how confident are you/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guessed' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unsure' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sure' })).toBeInTheDocument()
  })

  it('a correct answer reveals "Correct" and the grade options', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    renderSession(card)

    await user.type(screen.getByLabelText(/your answer/i), 'Paris')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.click(screen.getByRole('button', { name: 'Sure' }))

    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Correct')
    expect(screen.getByText('Correct answer: Paris')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /again/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^hard/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^good/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^easy/i })).toBeInTheDocument()
  })

  it('an incorrect answer reveals "Incorrect" plus what was actually typed', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    renderSession(card)

    await user.type(screen.getByLabelText(/your answer/i), 'London')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.click(screen.getByRole('button', { name: 'Sure' }))

    expect(screen.getByText('Incorrect')).toBeInTheDocument()
    expect(screen.getByText('Your answer: London')).toBeInTheDocument()
    expect(screen.getByText('Correct answer: Paris')).toBeInTheDocument()
  })

  it('grading calls onAdvance with the chosen grade and the auto-graded correctness', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    const onAdvance = renderSession(card)

    await user.type(screen.getByLabelText(/your answer/i), 'Paris')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.click(screen.getByRole('button', { name: 'Sure' }))
    await user.click(screen.getByRole('button', { name: /^easy/i }))

    expect(onAdvance).toHaveBeenCalledTimes(1)
    expect(onAdvance).toHaveBeenCalledWith('easy', true)
  })

  it('grading an incorrect attempt reports correct=false to onAdvance regardless of self-rated grade', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    const onAdvance = renderSession(card)

    await user.type(screen.getByLabelText(/your answer/i), 'wrong answer')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.click(screen.getByRole('button', { name: 'Sure' }))
    // Learner overrides the suggested "Again" and picks "Hard" anyway.
    await user.click(screen.getByRole('button', { name: /^hard/i }))

    expect(onAdvance).toHaveBeenCalledWith('hard', false)
  })
})

describe('ReviewSession keyboard shortcuts', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('confidence step responds to number-key shortcuts (1=Guessed)', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    renderSession(card)

    await user.type(screen.getByLabelText(/your answer/i), 'Paris')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.keyboard('1')

    expect(screen.getByText('Correct')).toBeInTheDocument()
  })

  it('reveal step responds to number-key shortcuts (1-4 for Again/Hard/Good/Easy)', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    const onAdvance = renderSession(card)

    await user.type(screen.getByLabelText(/your answer/i), 'Paris')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.click(screen.getByRole('button', { name: 'Sure' }))
    await user.keyboard('3') // GRADE_ORDER[2] === 'good'

    expect(onAdvance).toHaveBeenCalledWith('good', true)
  })
})

describe('ReviewSession self-explanation prompt', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('does not show a self-explanation prompt when the setting is off (default)', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    renderSession(card)

    await user.type(screen.getByLabelText(/your answer/i), 'Paris')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.click(screen.getByRole('button', { name: 'Sure' }))

    expect(screen.queryByLabelText(/why is that the correct answer/i)).not.toBeInTheDocument()
  })

  it('shows a self-explanation textarea on reveal when the setting is enabled', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card, { selfExplanationEnabled: true })
    renderSession(card)

    await user.type(screen.getByLabelText(/your answer/i), 'Paris')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.click(screen.getByRole('button', { name: 'Sure' }))

    const explanationField = screen.getByLabelText(/why is that the correct answer/i)
    expect(explanationField).toBeInTheDocument()
    await user.type(explanationField, 'It is the capital.')
    expect(explanationField).toHaveValue('It is the capital.')
  })
})

describe('ReviewSession card-change reset', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('resets to the answer step with a blank input when a new card is shown', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    const secondCard = makeCard({
      id: cardIdSchema.parse('c2222222-2222-4222-8222-222222222222'),
      prompt: 'What is 2+2?',
      content: { kind: 'short-answer', answer: '4', acceptableAnswers: [] },
    })
    seedStore(card)
    const onAdvance = vi.fn<(grade: string, correct: boolean) => void>()

    const { rerender } = render(
      <SeshatProvider>
        <ReviewSession card={card} position={0} total={2} onAdvance={onAdvance} />
      </SeshatProvider>,
    )
    await user.type(screen.getByLabelText(/your answer/i), 'Paris')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/how confident are you/i)).toBeInTheDocument()

    rerender(
      <SeshatProvider>
        <ReviewSession card={secondCard} position={1} total={2} onAdvance={onAdvance} />
      </SeshatProvider>,
    )

    expect(screen.getByText('What is 2+2?')).toBeInTheDocument()
    expect(screen.getByLabelText(/your answer/i)).toHaveValue('')
    expect(screen.queryByText(/how confident are you/i)).not.toBeInTheDocument()
  })
})
