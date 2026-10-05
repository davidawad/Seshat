import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import { saveState } from '../../lib/storage'
import { SeshatProvider } from '../../lib/store'
import { useKeybindings } from '../../lib/useKeybindings'
import { type StudyCard, cardIdSchema, createEmptyAppState, setIdSchema } from '../../types'
import { ReviewSession } from './ReviewSession'

/** Applies/reverts a keybinding override for real via the same module-level store the app uses (see lib/useKeybindings.ts) — not a mock. */
const KeybindingSetter = ({ actionId, keyValue }: { readonly actionId: string; readonly keyValue: string }) => {
  const { setBinding } = useKeybindings()
  return (
    <button type="button" onClick={() => setBinding(actionId, keyValue)}>
      remap
    </button>
  )
}
const remapAction = (actionId: string, keyValue: string) => {
  const { getByText, unmount } = render(<KeybindingSetter actionId={actionId} keyValue={keyValue} />)
  act(() => getByText('remap').click())
  unmount()
}
const resetAllKeybindings = () => {
  const Reset = () => {
    const { resetAll } = useKeybindings()
    return (
      <button type="button" onClick={() => resetAll()}>
        reset
      </button>
    )
  }
  const { getByText, unmount } = render(<Reset />)
  act(() => getByText('reset').click())
  unmount()
}

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
    promptImage: null,
    content: { kind: 'short-answer', answer: 'Paris', acceptableAnswers: [], answerImage: null },
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
    // Existing tests exercise the full flow; the lighter defaults live in the flag-combination suite.
    settings: { ...state.settings, confidencePromptEnabled: true, selfRatingPromptEnabled: true, ...settingsPatch },
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

describe('ReviewSession honors a remapped keybinding', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetAllKeybindings()
  })

  afterEach(() => {
    resetAllKeybindings()
  })

  it("stops responding to the old default key once 'studyReveal.good' is remapped, and responds to the new one", async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    remapAction('studyReveal.good', 'G')
    const onAdvance = renderSession(card)

    await user.type(screen.getByLabelText(/your answer/i), 'Paris')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.click(screen.getByRole('button', { name: 'Sure' }))

    await user.keyboard('3') // the old default — should no longer grade "good"
    expect(onAdvance).not.toHaveBeenCalled()

    await user.keyboard('g') // the remapped key
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
      content: { kind: 'short-answer', answer: '4', acceptableAnswers: [], answerImage: null },
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

const mcqCard = () =>
  makeCard({
    prompt: 'Pick one',
    content: { kind: 'mcq', options: ['Alpha', 'Beta', 'Gamma', 'Delta'], correctIndex: 1 },
  })

const startMcq = async (user: ReturnType<typeof userEvent.setup>) => {
  const card = mcqCard()
  seedStore(card)
  const onAdvance = renderSession(card)
  await user.click(screen.getByRole('button', { name: /show options/i }))
  return onAdvance
}

const reachConfidence = async (user: ReturnType<typeof userEvent.setup>) => {
  const card = makeCard()
  seedStore(card)
  const onAdvance = renderSession(card)
  await user.type(screen.getByLabelText(/your answer/i), 'Paris')
  await user.click(screen.getByRole('button', { name: /continue/i }))
  return onAdvance
}

describe('ReviewSession arrow-style option navigation', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetAllKeybindings()
  })

  afterEach(() => {
    resetAllKeybindings()
  })

  it('MCQ: nav.down/nav.up move the selected option (wrapping) and Enter submits; numbers still work', async () => {
    const user = userEvent.setup()
    await startMcq(user)
    const option = (name: string) => screen.getByRole('radio', { name })

    await user.keyboard('{ArrowDown}')
    expect(option('Alpha')).toHaveAttribute('aria-checked', 'true')
    expect(option('Alpha')).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(option('Beta')).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(option('Delta')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Option 4 of 4: Delta')

    await user.keyboard('3')
    expect(option('Gamma')).toHaveAttribute('aria-checked', 'true')

    await user.keyboard('{Enter}')
    expect(screen.getByText(/how confident are you/i)).toBeInTheDocument()
  })

  it('MCQ: Enter on a focused but unselected option selects it instead of submitting', async () => {
    const user = userEvent.setup()
    await startMcq(user)
    screen.getByRole('radio', { name: 'Gamma' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('radio', { name: 'Gamma' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText(/how confident are you/i)).not.toBeInTheDocument()
  })

  it('MCQ: ignores left/right and follows a WASD remap via setBinding', async () => {
    const user = userEvent.setup()
    remapAction('nav.up', 'W')
    remapAction('nav.down', 'S')
    await startMcq(user)

    await user.keyboard('{ArrowLeft}')
    expect(screen.queryByRole('radio', { checked: true })).toBeNull()
    await user.keyboard('{ArrowDown}') // old default no longer bound
    expect(screen.queryByRole('radio', { checked: true })).toBeNull()
    await user.keyboard('s')
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('w')
    expect(screen.getByRole('radio', { name: 'Delta' })).toHaveAttribute('aria-checked', 'true')
  })

  it('confidence step: left/right move focus, Enter commits', async () => {
    const user = userEvent.setup()
    await reachConfidence(user)

    expect(screen.getByRole('button', { name: 'Guessed' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Unsure' })).toHaveFocus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Guessed' })).toHaveFocus() // wrapped
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('button', { name: 'Sure' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByText('Correct')).toBeInTheDocument()
  })

  it('confidence step: HJKL remap moves the highlight and Enter commits it even after focus was lost', async () => {
    const user = userEvent.setup()
    remapAction('nav.left', 'H')
    remapAction('nav.right', 'L')
    await reachConfidence(user)

    await user.keyboard('l')
    expect(screen.getByRole('button', { name: 'Unsure' })).toHaveFocus()
    ;(document.activeElement as HTMLElement).blur()
    await user.keyboard('{Enter}')
    expect(screen.getByText('Correct')).toBeInTheDocument()
  })

  it('grading step: arrows move from the suggested grade and Enter commits', async () => {
    const user = userEvent.setup()
    const onAdvance = await reachConfidence(user)
    await user.click(screen.getByRole('button', { name: 'Sure' }))

    expect(screen.getByRole('button', { name: /^Good/ })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: /^Easy/ })).toHaveFocus()
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(screen.getByRole('button', { name: /^Hard/ })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onAdvance).toHaveBeenCalledWith('hard', true)
  })

  it('grading step: focus-less Enter commits the highlight and numbers still work', async () => {
    const user = userEvent.setup()
    const onAdvance = await reachConfidence(user)
    await user.click(screen.getByRole('button', { name: 'Sure' }))
    ;(document.activeElement as HTMLElement).blur()
    await user.keyboard('{Enter}')
    expect(onAdvance).toHaveBeenLastCalledWith('good', true)
    await user.keyboard('4')
    expect(onAdvance).toHaveBeenLastCalledWith('easy', true)
  })
})
