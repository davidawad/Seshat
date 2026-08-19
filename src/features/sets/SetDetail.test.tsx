import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import { newCardId, newSetId } from '../../lib/id'
import { saveState } from '../../lib/storage'
import { SeshatProvider } from '../../lib/store'
import { type CardId, type SetId, type Settings, type StudyCard, createEmptyAppState } from '../../types'
import { SetDetailPage } from './SetDetail'

// @testing-library/react's auto-cleanup needs a global `afterEach`, which
// this project doesn't enable (no `test.globals: true` in vite.config.ts) —
// without this, DOM from one test leaks into the next.
afterEach(() => cleanup())

const seedStore = (setId: SetId, cardId: CardId, settingsPatch: Partial<Settings> = {}) => {
  const now = new Date().toISOString()
  const state = createEmptyAppState()
  const card: StudyCard = {
    id: cardId,
    setId,
    prompt: 'A prompt',
    content: { kind: 'short-answer', answer: 'An answer', acceptableAnswers: [] },
    explanation: null,
    sourceRef: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
    scheduling: createInitialScheduling(new Date()),
  }
  saveState({
    ...state,
    sets: [{ id: setId, name: 'My Set', description: '', tags: [], createdAt: now, updatedAt: now, goalDate: null }],
    cards: [card],
    settings: { ...state.settings, ...settingsPatch },
  })
}

const renderSetDetail = (setId: SetId) =>
  render(
    <SeshatProvider>
      <MemoryRouter initialEntries={[`/sets/${setId}`]}>
        <Routes>
          <Route path="/sets/:id" element={<SetDetailPage />} />
        </Routes>
      </MemoryRouter>
    </SeshatProvider>,
  )

describe('SetDetailPage — Games mode-button visibility', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('shows the Games mode button when experimentalGamesEnabled is true (the default)', () => {
    const setId = newSetId()
    seedStore(setId, newCardId())
    renderSetDetail(setId)

    const gamesLink = screen.getByRole('link', { name: /Games/ })
    expect(gamesLink).toHaveAttribute('href', `/sets/${setId}/games`)
    expect(screen.getByText('Games')).toBeInTheDocument()
    expect(screen.getByText('Experimental — Match, Blast, Blocks and the like')).toBeInTheDocument()

    // The core modes are always present alongside it.
    expect(screen.getByRole('link', { name: /^Study/ })).toHaveAttribute('href', `/sets/${setId}/study`)
    expect(screen.getByRole('link', { name: /^Flashcards/ })).toHaveAttribute('href', `/sets/${setId}/flashcards`)
    expect(screen.getByRole('link', { name: /^Test/ })).toHaveAttribute('href', `/sets/${setId}/test`)
  })

  it('hides the Games mode button when experimentalGamesEnabled is false, while the core modes remain', () => {
    const setId = newSetId()
    seedStore(setId, newCardId(), { experimentalGamesEnabled: false })
    renderSetDetail(setId)

    expect(screen.queryByRole('link', { name: /Games/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Experimental — Match, Blast, Blocks and the like')).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: /^Study/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Flashcards/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Test/ })).toBeInTheDocument()
  })
})
