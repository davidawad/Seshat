import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import { STORAGE_KEY, saveState } from '../../lib/storage'
import { SeshatProvider } from '../../lib/store'
import { type Settings, type StudyCard, cardIdSchema, createEmptyAppState, setIdSchema } from '../../types'
import { ReviewSession } from './ReviewSession'

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

const seedStore = (card: StudyCard, settingsPatch: Partial<Settings>) => {
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

const renderSession = (card: StudyCard) => {
  const onAdvance = vi.fn<(grade: string, correct: boolean) => void>()
  render(
    <SeshatProvider>
      <ReviewSession card={card} position={0} total={5} onAdvance={onAdvance} />
    </SeshatProvider>,
  )
  return onAdvance
}

// The shipped defaults are both off; each test states its flags explicitly.
describe('ReviewSession study-flag combinations', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  const answer = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
    await user.type(screen.getByLabelText(/your answer/i), text)
    await user.click(screen.getByRole('button', { name: /continue/i }))
  }
  const storedLog = () => window.localStorage.getItem(STORAGE_KEY) ?? ''

  it('off/off: answer -> feedback + autofocused Continue; correct derives good, confidence null', async () => {
    const user = userEvent.setup()
    const card = makeCard({ explanation: 'Because geography.' })
    seedStore(card, { confidencePromptEnabled: false, selfRatingPromptEnabled: false })
    const onAdvance = renderSession(card)

    await answer(user, 'Paris')
    expect(screen.queryByText(/how confident are you/i)).not.toBeInTheDocument()
    expect(screen.getByText('Correct')).toBeInTheDocument()
    expect(screen.getByText(/correct answer: paris/i)).toBeInTheDocument()
    expect(screen.getByText('Because geography.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^again/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue/i })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onAdvance).toHaveBeenCalledWith('good', true)
    expect(storedLog()).toContain('"confidence":null')
  })

  it('off/off: an incorrect answer derives again', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card, { confidencePromptEnabled: false, selfRatingPromptEnabled: false })
    const onAdvance = renderSession(card)

    await answer(user, 'Lyon')
    expect(screen.getByText('Incorrect')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(onAdvance).toHaveBeenCalledWith('again', false)
  })

  it('on/off: confidence step, then feedback + Continue with the derived grade', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card, { confidencePromptEnabled: true, selfRatingPromptEnabled: false })
    const onAdvance = renderSession(card)

    await answer(user, 'Paris')
    expect(screen.getByText(/how confident are you/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Sure' }))
    expect(screen.queryByRole('button', { name: /^good/i })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(onAdvance).toHaveBeenCalledWith('good', true)
    expect(storedLog()).toContain('"confidence":"sure"')
  })

  it('off/on: skips confidence, offers the four grades, number keys work', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card, { confidencePromptEnabled: false, selfRatingPromptEnabled: true })
    const onAdvance = renderSession(card)

    await answer(user, 'Paris')
    expect(screen.queryByText(/how confident are you/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^easy/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument()
    await user.keyboard('4')
    expect(onAdvance).toHaveBeenCalledWith('easy', true)
    expect(storedLog()).toContain('"confidence":null')
  })

  it("on/on: today's full flow", async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card, { confidencePromptEnabled: true, selfRatingPromptEnabled: true })
    const onAdvance = renderSession(card)

    await answer(user, 'Paris')
    await user.click(screen.getByRole('button', { name: 'Unsure' }))
    await user.click(screen.getByRole('button', { name: /^hard/i }))
    expect(onAdvance).toHaveBeenCalledWith('hard', true)
    expect(storedLog()).toContain('"confidence":"unsure"')
  })
})
