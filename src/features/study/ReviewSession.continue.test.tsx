import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import { saveState } from '../../lib/storage'
import { SeshatProvider } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
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
