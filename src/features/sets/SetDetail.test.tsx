import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import { newCardId, newSetId } from '../../lib/id'
import { saveState } from '../../lib/storage'
import { SeshatProvider } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
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
    promptImage: null,
    content: { kind: 'short-answer', answer: 'An answer', acceptableAnswers: [], answerImage: null },
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
    expect(screen.getByText('Experimental: Match, Blast, Blocks and the like')).toBeInTheDocument()

    // The core modes are always present alongside it.
    expect(screen.getByRole('link', { name: 'Start studying' })).toHaveAttribute('href', `/sets/${setId}/study`)
    expect(screen.getByRole('link', { name: /^Flashcards/ })).toHaveAttribute('href', `/sets/${setId}/flashcards`)
    expect(screen.getByRole('link', { name: /^Test/ })).toHaveAttribute('href', `/sets/${setId}/test`)
  })

  it('hides the Games mode button when experimentalGamesEnabled is false, while the core modes remain', () => {
    const setId = newSetId()
    seedStore(setId, newCardId(), { experimentalGamesEnabled: false })
    renderSetDetail(setId)

    expect(screen.queryByRole('link', { name: /Games/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Experimental: Match, Blast, Blocks and the like')).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Start studying' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Flashcards/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Test/ })).toBeInTheDocument()
  })
})

describe('SetDetailPage: one primary action', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('has a single primary Start studying link; Flashcards and Test are secondary', () => {
    const setId = newSetId()
    seedStore(setId, newCardId())
    renderSetDetail(setId)
    const nav = screen.getByRole('navigation', { name: 'Study modes' })
    const start = within(nav).getByTestId(TESTIDS.setModeStudy)
    expect(start).toHaveTextContent('Start studying')
    expect(start).toHaveClass('primary-link')
    expect(start).toHaveAttribute('href', `/sets/${setId}/study`)
    expect(nav.querySelectorAll('.primary-link')).toHaveLength(1)
    expect(within(nav).getByTestId(TESTIDS.setModeFlashcards)).not.toHaveClass('primary-link')
    expect(within(nav).getByTestId(TESTIDS.setModeTest)).not.toHaveClass('primary-link')
    const learn = within(nav).getByTestId(TESTIDS.setModeLearn)
    expect(learn).not.toHaveClass('primary-link')
    expect(learn).toHaveAttribute('href', `/sets/${setId}/learn`)
  })

  it('tucks Games into a closed More disclosure outside the main mode links', () => {
    const setId = newSetId()
    seedStore(setId, newCardId())
    renderSetDetail(setId)
    const more = screen.getByText('More').closest('details')!
    expect(more).not.toHaveAttribute('open')
    expect(within(more).getByTestId(TESTIDS.setModeGames)).toHaveAttribute('href', `/sets/${setId}/games`)
    const nav = screen.getByRole('navigation', { name: 'Study modes' })
    expect(within(nav).queryByTestId(TESTIDS.setModeGames)).not.toBeInTheDocument()
  })

  it('omits the More disclosure entirely when games are off', () => {
    const setId = newSetId()
    seedStore(setId, newCardId(), { experimentalGamesEnabled: false })
    renderSetDetail(setId)
    expect(screen.queryByText('More')).not.toBeInTheDocument()
  })

  it('still jumps to a mode with the number keys, 1 being Start studying', async () => {
    const setId = newSetId()
    seedStore(setId, newCardId())
    const user = userEvent.setup()
    const Where = () => <p data-testid="where">{useLocation().pathname}</p>
    render(
      <SeshatProvider>
        <MemoryRouter initialEntries={[`/sets/${setId}`]}>
          <Routes>
            <Route path="/sets/:id" element={<SetDetailPage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </SeshatProvider>,
    )
    await user.keyboard('1')
    expect(screen.getByTestId('where')).toHaveTextContent(`/sets/${setId}/study`)
  })

  it('jumps to Learn with 4', async () => {
    const setId = newSetId()
    seedStore(setId, newCardId())
    const user = userEvent.setup()
    const Where = () => <p data-testid="where">{useLocation().pathname}</p>
    render(
      <SeshatProvider>
        <MemoryRouter initialEntries={[`/sets/${setId}`]}>
          <Routes>
            <Route path="/sets/:id" element={<SetDetailPage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </SeshatProvider>,
    )
    await user.keyboard('4')
    expect(screen.getByTestId('where')).toHaveTextContent(`/sets/${setId}/learn`)
  })
})
