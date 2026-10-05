import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, expect } from 'vitest'
import { App } from './App'
import { headingLevels, headingSkips, unnamedInteractive } from './lib/a11y-audit'
import { createInitialScheduling } from './lib/fsrs'
import { saveState } from './lib/storage'
import { SeshatProvider } from './lib/store'
import { type CardId, type StudyCard, cardIdSchema, createEmptyAppState, setIdSchema } from './types'

/** Shared fixtures for the accessibility suites (a11y-*.test.tsx): jsdom stubs, seeded app state, a full-app renderer. */

export const installA11yTestEnv = () => {
  afterEach(() => cleanup())
  // jsdom has no native <dialog> modal support; stub the two methods Modal.tsx calls.
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
      this.removeAttribute('open')
    }
    HTMLElement.prototype.setPointerCapture ??= () => undefined
    HTMLElement.prototype.hasPointerCapture ??= () => false
    HTMLElement.prototype.releasePointerCapture ??= () => undefined
  })
}

export const setId = setIdSchema.parse('a1111111-1111-4111-8111-111111111111')
const cardSpecs: readonly (readonly [CardId, StudyCard['content']])[] = [
  [
    cardIdSchema.parse('c1111111-1111-4111-8111-111111111111'),
    { kind: 'short-answer', answer: 'Paris', acceptableAnswers: [], answerImage: null },
  ],
  [
    cardIdSchema.parse('c2222222-2222-4222-8222-222222222222'),
    { kind: 'cloze', text: 'The capital of Spain is {{Madrid}}.' },
  ],
  [
    cardIdSchema.parse('c3333333-3333-4333-8333-333333333333'),
    { kind: 'mcq', options: ['Rome', 'Oslo', 'Bern'], correctIndex: 0 },
  ],
  [
    cardIdSchema.parse('c4444444-4444-4444-8444-444444444444'),
    { kind: 'short-answer', answer: 'Berlin', acceptableAnswers: [], answerImage: null },
  ],
]

export const seed = () => {
  const now = new Date().toISOString()
  saveState({
    ...createEmptyAppState(),
    sets: [
      {
        id: setId,
        name: 'Capitals',
        description: 'Cities',
        tags: ['geo'],
        createdAt: now,
        updatedAt: now,
        goalDate: null,
      },
    ],
    cards: cardSpecs.map(([id, content], index) => ({
      id,
      setId,
      prompt: `Prompt ${index + 1}`,
      promptImage: null,
      content,
      explanation: null,
      sourceRef: null,
      tags: [],
      createdAt: now,
      updatedAt: now,
      scheduling: {
        ...createInitialScheduling(new Date()),
        due: new Date(Date.UTC(2020, 0, 1, 0, 0, index)).toISOString(),
      },
    })),
    settings: {
      ...createEmptyAppState().settings,
      experimentalGamesEnabled: true,
      // The a11y study flow walks every optional step.
      confidencePromptEnabled: true,
      selfRatingPromptEnabled: true,
    },
  })
}

export const renderAt = (path: string) =>
  render(
    <SeshatProvider>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </SeshatProvider>,
  )

/** The audit every page must pass: nothing interactive without a name, no skipped heading levels. */
export const expectAccessible = (container: HTMLElement) => {
  expect(unnamedInteractive(container)).toEqual([])
  expect(headingSkips(headingLevels(container))).toEqual([])
}

export const base = `/sets/${setId}`
