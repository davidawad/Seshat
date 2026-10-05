import { render } from '@testing-library/react'
import { vi } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import { saveState } from '../../lib/storage'
import { SeshatProvider } from '../../lib/store'
import { type StudyCard, cardIdSchema, createEmptyAppState, setIdSchema } from '../../types'
import { FlashcardSession } from './FlashcardSession'
import type { FlashcardOptions } from './options'
import type { GradeRecord } from './session'

// Shared fixtures for the FlashcardSession test files.

export const setId = setIdSchema.parse('a1111111-1111-4111-8111-111111111111')
export const cardId = cardIdSchema.parse('c1111111-1111-4111-8111-111111111111')

export const makeCard = (): StudyCard => {
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
  }
}

export const seedStore = (card: StudyCard) => {
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

const defaultOptions: FlashcardOptions = { trackProgress: true, front: 'term', cardSize: 'small' }

export interface RenderOverrides {
  readonly options?: FlashcardOptions
  readonly shortcutsEnabled?: boolean
  readonly canUndo?: boolean
  readonly shuffled?: boolean
}

export const sessionElement = (
  card: StudyCard,
  handlers: ReturnType<typeof makeHandlers>,
  overrides: RenderOverrides = {},
) => (
  <SeshatProvider>
    <FlashcardSession
      card={card}
      position={0}
      total={3}
      options={overrides.options ?? defaultOptions}
      shortcutsEnabled={overrides.shortcutsEnabled ?? true}
      knownCount={4}
      unknownCount={2}
      canUndo={overrides.canUndo ?? false}
      shuffled={overrides.shuffled ?? true}
      onGrade={handlers.onGrade}
      onUndo={handlers.onUndo}
      onToggleShuffle={handlers.onToggleShuffle}
      onOpenOptions={handlers.onOpenOptions}
    />
  </SeshatProvider>
)

export const makeHandlers = () => ({
  onGrade: vi.fn<(record: GradeRecord) => void>(),
  onUndo: vi.fn<() => void>(),
  onToggleShuffle: vi.fn<() => void>(),
  onOpenOptions: vi.fn<() => void>(),
})

export const renderSession = (card: StudyCard, overrides: RenderOverrides = {}) => {
  const handlers = makeHandlers()
  render(sessionElement(card, handlers, overrides))
  return handlers
}
