import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import { saveState } from '../../lib/storage'
import { SeshatProvider } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import { useKeybindings } from '../../lib/useKeybindings'
import { type StudyCard, cardIdSchema, createEmptyAppState, setIdSchema } from '../../types'
import { LearnQuestion } from '../learn/LearnQuestion'
import { ReviewSession } from './ReviewSession'

afterEach(() => cleanup())

const setId = setIdSchema.parse('a1111111-1111-4111-8111-111111111111')
const cardId = cardIdSchema.parse('c1111111-1111-4111-8111-111111111111')

const card = (): StudyCard => {
  const now = new Date().toISOString()
  return {
    id: cardId,
    setId,
    prompt: 'Capital of France?',
    promptImage: null,
    content: { kind: 'short-answer', answer: 'Paris', acceptableAnswers: [], answerImage: null },
    explanation: null,
    sourceRef: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
    scheduling: createInitialScheduling(new Date()),
  }
}

const seed = (selfRatingPromptEnabled = false) => {
  const state = createEmptyAppState()
  saveState({
    ...state,
    settings: { ...state.settings, confidencePromptEnabled: false, selfRatingPromptEnabled },
  })
}

/** The card panel is `.illuminated-panel`; Continue must be rendered after it, never inside it. */
const expectContinueBelowCard = () => {
  const button = screen.getByTestId(TESTIDS.studyContinue)
  const panel = document.querySelector('.illuminated-panel')
  expect(panel).not.toBeNull()
  expect(panel?.contains(button)).toBe(false)
  expect(panel?.compareDocumentPosition(button)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
}

describe('Continue sits outside the card panel', () => {
  beforeEach(() => window.localStorage.clear())

  it('Study: on the answer step and on the reveal step', async () => {
    seed()
    const user = userEvent.setup()
    render(
      <SeshatProvider>
        <ReviewSession card={card()} position={0} total={1} onAdvance={vi.fn()} />
      </SeshatProvider>,
    )
    expectContinueBelowCard()
    await user.type(screen.getByTestId(TESTIDS.studyAnswerInput), 'Paris')
    await user.click(screen.getByTestId(TESTIDS.studyContinue))
    expect(screen.getByTestId(TESTIDS.studyResult)).toBeInTheDocument()
    expectContinueBelowCard()
  })

  it('Learn: on the reveal step (after "I don\'t know")', async () => {
    seed()
    const user = userEvent.setup()
    render(
      <SeshatProvider>
        <LearnQuestion card={card()} cards={[card()]} stage="typed" onDone={vi.fn()} />
      </SeshatProvider>,
    )
    await user.click(screen.getByTestId(TESTIDS.learnDontKnow))
    expectContinueBelowCard()
  })
})

const renderStudy = (onAdvance = vi.fn<(grade: string, correct: boolean) => void>()) => {
  render(
    <SeshatProvider>
      <ReviewSession card={card()} position={0} total={1} onAdvance={onAdvance} />
    </SeshatProvider>,
  )
  return onAdvance
}

const blurActive = () => act(() => (document.activeElement as HTMLElement | null)?.blur())

describe('Space presses Continue (studyContinue.next)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    seed()
  })

  it('on the answer step once an answer is typed, but types a space in the text field', async () => {
    const user = userEvent.setup()
    renderStudy()
    await user.type(screen.getByTestId(TESTIDS.studyAnswerInput), 'New York')
    expect(screen.getByTestId(TESTIDS.studyAnswerInput)).toHaveValue('New York')
    expect(screen.queryByTestId(TESTIDS.studyResult)).not.toBeInTheDocument()
    blurActive()
    await user.keyboard(' ')
    expect(screen.getByTestId(TESTIDS.studyResult)).toBeInTheDocument()
  })

  it('does nothing on the answer step while Continue is disabled', async () => {
    const user = userEvent.setup()
    renderStudy()
    await user.keyboard(' ')
    expect(screen.queryByTestId(TESTIDS.studyResult)).not.toBeInTheDocument()
  })

  it('on the reveal step with nothing focused, advances once with the derived grade', async () => {
    const user = userEvent.setup()
    const onAdvance = renderStudy()
    await user.type(screen.getByTestId(TESTIDS.studyAnswerInput), 'Paris')
    await user.click(screen.getByTestId(TESTIDS.studyContinue))
    blurActive()
    await user.keyboard(' ')
    expect(onAdvance).toHaveBeenCalledTimes(1)
    expect(onAdvance).toHaveBeenCalledWith('good', true)
  })

  it('with the focused Continue button, Space activates it natively and only once', async () => {
    const user = userEvent.setup()
    const onAdvance = renderStudy()
    await user.type(screen.getByTestId(TESTIDS.studyAnswerInput), 'Paris')
    await user.click(screen.getByTestId(TESTIDS.studyContinue))
    expect(screen.getByTestId(TESTIDS.studyContinue)).toHaveFocus()
    await user.keyboard(' ')
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })

  it('is not stolen from the self-explanation textarea', async () => {
    const state = createEmptyAppState()
    saveState({
      ...state,
      settings: { ...state.settings, confidencePromptEnabled: false, selfExplanationEnabled: true },
    })
    const user = userEvent.setup()
    const onAdvance = renderStudy()
    await user.type(screen.getByTestId(TESTIDS.studyAnswerInput), 'Paris')
    await user.click(screen.getByTestId(TESTIDS.studyContinue))
    await user.type(screen.getByTestId(TESTIDS.studySelfExplanation), 'a b')
    expect(screen.getByTestId(TESTIDS.studySelfExplanation)).toHaveValue('a b')
    expect(onAdvance).not.toHaveBeenCalled()
  })

  it('with self-rating on there is no Continue: Space keeps confirming the highlighted grade, once', async () => {
    seed(true)
    const user = userEvent.setup()
    const onAdvance = renderStudy()
    await user.type(screen.getByTestId(TESTIDS.studyAnswerInput), 'Paris')
    await user.click(screen.getByTestId(TESTIDS.studyContinue))
    blurActive()
    await user.keyboard(' ')
    expect(onAdvance).toHaveBeenCalledTimes(1)
    expect(onAdvance).toHaveBeenCalledWith('good', true)
  })

  it('is remappable like the other shortcuts', async () => {
    const user = userEvent.setup()
    const Remap = () => {
      const { setBinding, resetAll } = useKeybindings()
      return (
        <>
          <button type="button" onClick={() => setBinding('studyContinue.next', 'N')}>
            remap
          </button>
          <button type="button" onClick={() => resetAll()}>
            reset
          </button>
        </>
      )
    }
    const onAdvance = vi.fn<(grade: string, correct: boolean) => void>()
    render(
      <SeshatProvider>
        <Remap />
        <ReviewSession card={card()} position={0} total={1} onAdvance={onAdvance} />
      </SeshatProvider>,
    )
    await user.click(screen.getByText('remap'))
    await user.type(screen.getByTestId(TESTIDS.studyAnswerInput), 'Paris')
    await user.click(screen.getByTestId(TESTIDS.studyContinue))
    blurActive()
    await user.keyboard(' ')
    expect(onAdvance).not.toHaveBeenCalled()
    await user.keyboard('n')
    expect(onAdvance).toHaveBeenCalledTimes(1)
    await user.click(screen.getByText('reset'))
  })

  it('on the Learn reveal step', async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(
      <SeshatProvider>
        <LearnQuestion card={card()} cards={[card()]} stage="typed" onDone={onDone} />
      </SeshatProvider>,
    )
    await user.click(screen.getByTestId(TESTIDS.learnDontKnow))
    blurActive()
    await user.keyboard(' ')
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
