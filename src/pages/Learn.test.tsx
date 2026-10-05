import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../lib/fsrs'
import { newCardId, newSetId } from '../lib/id'
import { STORAGE_KEY, saveState } from '../lib/storage'
import { SeshatProvider } from '../lib/store'
import { TESTIDS } from '../lib/testids'
import { type AppState, type SetId, type Settings, type StudyCard, createEmptyAppState } from '../types'
import { LearnPage } from './Learn'
import { SetsPage } from './Sets'

afterEach(() => cleanup())

const makeCard = (setId: SetId, index: number): StudyCard => {
  const now = new Date().toISOString()
  return {
    id: newCardId(),
    setId,
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

const seed = (cardCount: number, settingsPatch: Partial<Settings> = {}): SetId => {
  const setId = newSetId()
  const now = new Date().toISOString()
  const state = createEmptyAppState()
  saveState({
    ...state,
    sets: [{ id: setId, name: 'Capitals', description: '', tags: [], createdAt: now, updatedAt: now, goalDate: null }],
    cards: Array.from({ length: cardCount }, (_, index) => makeCard(setId, index + 1)),
    settings: { ...state.settings, ...settingsPatch },
  })
  return setId
}

const renderLearn = (setId: SetId) =>
  render(
    <SeshatProvider>
      <MemoryRouter initialEntries={[`/sets/${setId}/learn`]}>
        <Routes>
          <Route path="/sets/:id/learn" element={<LearnPage />} />
        </Routes>
      </MemoryRouter>
    </SeshatProvider>,
  )

const reviewLog = (): AppState['reviewLog'] =>
  (JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as AppState).reviewLog

/** The number N of the "Prompt N" being asked. */
const askedIndex = (): number => Number(/Prompt (\d+)/.exec(screen.getByTestId(TESTIDS.learnPrompt).textContent)?.[1])

const stage = (): string | null => screen.getByTestId(TESTIDS.learnStage).textContent

/** Answers the current question (multiple choice or typed), right or wrong, then presses Continue. */
const answerCurrent = async (user: UserEvent, correct: boolean) => {
  const n = askedIndex()
  if (stage() === 'Multiple choice') {
    const isRight = new RegExp(`^Answer ${n}( |$)`)
    const options = screen.getAllByTestId(TESTIDS.learnOption)
    const chosen = options.find((option) => isRight.test(option.textContent) === correct)
    await user.click(chosen!)
  } else {
    await user.type(screen.getByLabelText('Your answer'), correct ? `Answer ${n}` : 'nope')
    await user.click(screen.getByTestId(TESTIDS.learnCheck))
  }
  await user.click(screen.getByTestId(TESTIDS.studyContinue))
}

describe('LearnPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('starts with multiple choice drawn from the set and puts focus on the prompt', () => {
    renderLearn(seed(5))
    expect(screen.getByRole('heading', { level: 1, name: 'Learn: Capitals' })).toBeInTheDocument()
    expect(stage()).toBe('Multiple choice')
    expect(screen.getByTestId(TESTIDS.learnPrompt)).toHaveFocus()
    const group = screen.getByRole('group', { name: /Prompt \d/ })
    const options = within(group).getAllByTestId(TESTIDS.learnOption)
    expect(options.length).toBeGreaterThanOrEqual(2)
    expect(options.length).toBeLessThanOrEqual(4)
    expect(within(group).getByRole('button', { name: new RegExp(`^Answer ${askedIndex()}\\b`) })).toBeInTheDocument()
  })

  it('shows feedback in a live region and records a recognition miss as an again review', async () => {
    const user = userEvent.setup()
    renderLearn(seed(5))
    const n = askedIndex()
    const isRight = new RegExp(`^Answer ${n}( |$)`)
    const wrong = screen.getAllByTestId(TESTIDS.learnOption).find((option) => !isRight.test(option.textContent))
    await user.click(wrong!)
    expect(screen.getByTestId(TESTIDS.studyResult)).toHaveTextContent('Incorrect')
    expect(screen.getByText(`Correct answer: Answer ${n}`)).toBeInTheDocument()
    expect(screen.getByTestId(TESTIDS.studyContinue)).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(reviewLog()).toHaveLength(1)
    expect(reviewLog()[0]).toMatchObject({ grade: 'again', correct: false })
  })

  it('brings a missed card back soon, still as multiple choice', async () => {
    const user = userEvent.setup()
    renderLearn(seed(5))
    const missed = askedIndex()
    await answerCurrent(user, false)
    await answerCurrent(user, true)
    await answerCurrent(user, true)
    expect(askedIndex()).toBe(missed)
    expect(stage()).toBe('Multiple choice')
  })

  it('does not record correct recognition answers; they only promote the card to typing', async () => {
    const user = userEvent.setup()
    renderLearn(seed(5))
    for (let i = 0; i < 5; i++) await answerCurrent(user, true)
    expect(reviewLog()).toHaveLength(0)
    const summary = screen.getByTestId(TESTIDS.learnRoundSummary)
    expect(within(summary).getByRole('heading', { name: 'Round 1 complete' })).toHaveFocus()
    expect(within(summary).getByRole('list', { name: 'Cards in this round' }).children).toHaveLength(5)
    expect(within(summary).getAllByText('Learning')).toHaveLength(6)
  })

  it('walks a small set from multiple choice to typed recall to a finished session, feeding FSRS', async () => {
    const user = userEvent.setup()
    renderLearn(seed(3))
    for (let i = 0; i < 3; i++) await answerCurrent(user, true)
    await user.click(screen.getByTestId(TESTIDS.learnNextRound))
    expect(stage()).toBe('Type the answer')
    expect(screen.getByLabelText('Your answer')).toHaveFocus()
    for (let i = 0; i < 3; i++) await answerCurrent(user, true)
    expect(screen.getByTestId(TESTIDS.learnRoundSummary)).toHaveTextContent('Round 2 complete')
    await user.click(screen.getByRole('button', { name: 'See results' }))
    const summary = screen.getByTestId(TESTIDS.learnSummary)
    expect(within(summary).getByRole('heading', { name: 'Every term mastered' })).toHaveFocus()
    expect(summary).toHaveTextContent('100%')
    // Three typed-correct answers reached the shared review log (what Stats and set progress read).
    expect(reviewLog().map((entry) => [entry.grade, entry.correct])).toEqual([
      ['good', true],
      ['good', true],
      ['good', true],
    ])
    const state = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as AppState
    expect(state.cards.every((card) => card.scheduling.reps > 0)).toBe(true)
  })

  it('"End session" stops with a summary of what was done', async () => {
    const user = userEvent.setup()
    renderLearn(seed(5))
    await answerCurrent(user, true)
    await user.click(screen.getByRole('button', { name: 'End session' }))
    const summary = screen.getByTestId(TESTIDS.learnSummary)
    expect(within(summary).getByRole('heading', { name: 'Session complete' })).toBeInTheDocument()
    expect(summary).toHaveTextContent('Questions')
    await user.click(screen.getByTestId(TESTIDS.learnRestart))
    expect(stage()).toBe('Multiple choice')
  })

  it('answers multiple choice with the digit keys', async () => {
    const user = userEvent.setup()
    renderLearn(seed(5))
    await user.keyboard('1')
    expect(screen.getByTestId(TESTIDS.studyResult)).toBeInTheDocument()
  })

  it('treats "I don\'t know" as a miss', async () => {
    const user = userEvent.setup()
    renderLearn(seed(5))
    await user.click(screen.getByTestId(TESTIDS.learnDontKnow))
    expect(screen.getByTestId(TESTIDS.studyResult)).toHaveTextContent('Incorrect')
  })

  it('starts a card at typed recall when the set cannot supply distractors', () => {
    renderLearn(seed(1))
    expect(stage()).toBe('Type the answer')
  })

  it('shows the cited research and reaches it as real links', () => {
    renderLearn(seed(2))
    const research = screen.getByTestId(TESTIDS.learnResearch)
    const links = within(research).getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://doi.org/10.1037/a0037559',
      'https://doi.org/10.1037/a0023956',
    ])
  })

  it('explains an empty set instead of starting', () => {
    renderLearn(seed(0))
    expect(screen.getByTestId(TESTIDS.learnEmpty)).toBeInTheDocument()
    expect(screen.queryByTestId(TESTIDS.learnProgress)).not.toBeInTheDocument()
  })

  it('says so for an unknown set', () => {
    renderLearn(newSetId())
    expect(screen.getByText('This set may have been deleted.')).toBeInTheDocument()
  })
})

describe('LearnPage settings flags (typed answers)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('asks confidence before the reveal when that setting is on, and logs it', async () => {
    const user = userEvent.setup()
    renderLearn(seed(1, { confidencePromptEnabled: true }))
    await user.type(screen.getByLabelText('Your answer'), 'Answer 1')
    await user.click(screen.getByTestId(TESTIDS.learnCheck))
    expect(screen.getByText(/how confident are you/i)).toBeInTheDocument()
    expect(screen.queryByTestId(TESTIDS.studyResult)).not.toBeInTheDocument()
    await user.click(screen.getByTestId(TESTIDS.studyConfidenceSure))
    expect(screen.getByTestId(TESTIDS.studyResult)).toHaveTextContent('Correct')
    await user.click(screen.getByTestId(TESTIDS.studyContinue))
    expect(reviewLog()[0]).toMatchObject({ confidence: 'sure', grade: 'good', correct: true })
  })

  it('offers the Again/Hard/Good/Easy self-rating when that setting is on and logs the choice', async () => {
    const user = userEvent.setup()
    renderLearn(seed(1, { selfRatingPromptEnabled: true }))
    await user.type(screen.getByLabelText('Your answer'), 'Answer 1')
    await user.click(screen.getByTestId(TESTIDS.learnCheck))
    expect(screen.queryByTestId(TESTIDS.studyContinue)).not.toBeInTheDocument()
    await user.click(screen.getByTestId(TESTIDS.studyGradeEasy))
    expect(reviewLog()[0]).toMatchObject({ grade: 'easy', correct: true })
  })

  it('shows neither prompt by default', async () => {
    const user = userEvent.setup()
    renderLearn(seed(1))
    await user.type(screen.getByLabelText('Your answer'), 'Answer 1')
    await user.click(screen.getByTestId(TESTIDS.learnCheck))
    expect(screen.queryByText(/how confident are you/i)).not.toBeInTheDocument()
    expect(screen.getByTestId(TESTIDS.studyContinue)).toBeInTheDocument()
  })
})

describe('the lazy /sets/:id/learn route', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('loads on demand from the Sets router', async () => {
    const setId = seed(3)
    render(
      <SeshatProvider>
        <MemoryRouter initialEntries={[`/sets/${setId}/learn`]}>
          <Routes>
            <Route path="/sets/*" element={<SetsPage />} />
          </Routes>
        </MemoryRouter>
      </SeshatProvider>,
    )
    expect(await screen.findByTestId(TESTIDS.learnPage)).toBeInTheDocument()
  })
})
