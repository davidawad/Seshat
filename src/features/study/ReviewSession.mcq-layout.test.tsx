import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import { saveState } from '../../lib/storage'
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

const mcqCard = () =>
  makeCard({
    prompt: 'Pick one',
    content: { kind: 'mcq', options: ['Alpha', 'Beta', 'Gamma', 'Delta'], correctIndex: 1 },
  })

describe('ReviewSession multiple-choice layout (options outside the card)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shows the options at once by default, as a labelled radio group outside the card', () => {
    const card = mcqCard()
    seedStore(card, {})
    renderSession(card)

    const group = screen.getByRole('radiogroup', { name: /answer options/i })
    expect(screen.queryByRole('button', { name: /show options/i })).not.toBeInTheDocument()
    expect(group.closest('.illuminated-panel')).toBeNull()
    expect(group).toHaveAttribute('data-length', 'short')
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    expect(screen.getByText('Pick one').closest('.illuminated-panel')).not.toBeNull()
  })

  it('marks long options so a phone stacks them one per row', () => {
    const card = makeCard({
      prompt: 'Pick one',
      content: {
        kind: 'mcq',
        options: ['A fairly long first answer', 'Another long answer', 'Third'],
        correctIndex: 0,
      },
    })
    seedStore(card, {})
    renderSession(card)
    expect(screen.getByRole('radiogroup')).toHaveAttribute('data-length', 'long')
  })

  it('with "show options on request" on, only the prompt shows until the button is pressed', async () => {
    const user = userEvent.setup()
    const card = mcqCard()
    seedStore(card, { mcqShowOptionsOnRequest: true })
    renderSession(card)

    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /show options/i }))
    expect(screen.queryByRole('button', { name: /show options/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveFocus()
  })
})
