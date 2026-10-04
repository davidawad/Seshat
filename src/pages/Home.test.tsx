import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../lib/fsrs'
import { clearMirrors } from '../lib/persistence'
import { saveState } from '../lib/storage'
import { SeshatProvider } from '../lib/store'
import { TESTIDS } from '../lib/testids'
import { type StudyCard, cardIdSchema, createEmptyAppState, setIdSchema } from '../types'
import { HomePage } from './Home'

afterEach(() => cleanup())

beforeEach(() => {
  window.localStorage.clear()
  clearMirrors()
})

const setId = setIdSchema.parse('a1111111-1111-4111-8111-111111111111')
const now = new Date().toISOString()

const card = (id: string): StudyCard => ({
  id: cardIdSchema.parse(id),
  setId,
  prompt: 'p',
  content: { kind: 'short-answer', answer: 'a', acceptableAnswers: [] },
  explanation: null,
  sourceRef: null,
  tags: [],
  createdAt: now,
  updatedAt: now,
  scheduling: createInitialScheduling(new Date()),
})

const seed = () =>
  saveState({
    ...createEmptyAppState(),
    sets: [{ id: setId, name: 'Anatomy', description: '', tags: [], createdAt: now, updatedAt: now, goalDate: null }],
    cards: [card('c1111111-1111-4111-8111-111111111111'), card('c2222222-2222-4222-8222-222222222222')],
  })

const renderHome = () =>
  render(
    <SeshatProvider>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </SeshatProvider>,
  )

describe('HomePage view toggle', () => {
  it('shows the card grid with a New set tile by default and no toggle when there are no sets', () => {
    renderHome()
    expect(screen.queryByTestId(TESTIDS.homeViewToggle)).not.toBeInTheDocument()
  })

  it('defaults to cards, switches to a table, and remembers the choice', async () => {
    seed()
    const user = userEvent.setup()
    const first = renderHome()

    expect(screen.getByRole('radio', { name: 'Card view' })).toBeChecked()
    expect(screen.queryByTestId(TESTIDS.homeSetTable)).not.toBeInTheDocument()
    expect(screen.getByTestId(TESTIDS.homeNewSet)).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Table view' }))

    const table = screen.getByTestId(TESTIDS.homeSetTable)
    const row = within(table).getByTestId(TESTIDS.homeSetRow)
    expect(within(row).getByRole('link', { name: 'Anatomy' })).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: 'Study Anatomy' })).toBeInTheDocument()
    expect(within(row).getByRole('progressbar', { name: /0 of 2 cards memorized/ })).toBeInTheDocument()
    expect(screen.getByTestId(TESTIDS.homeNewSet)).toHaveAttribute('href', '/sets/new')

    first.unmount()
    renderHome()
    expect(screen.getByRole('radio', { name: 'Table view' })).toBeChecked()
    expect(screen.getByTestId(TESTIDS.homeSetTable)).toBeInTheDocument()
  })

  it('is one radio group named "Set view" with exactly two options', () => {
    seed()
    renderHome()
    const group = screen.getByRole('radiogroup', { name: 'Set view' })
    expect(within(group).getAllByRole('radio')).toHaveLength(2)
  })
})
