import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import { clearMirrors } from '../../lib/persistence'
import { saveState } from '../../lib/storage'
import { SeshatProvider } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import { type StudyCard, cardIdSchema, createEmptyAppState, setIdSchema } from '../../types'
import { SetsBrowser } from './SetsBrowser'

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

const renderBrowser = () =>
  render(
    <SeshatProvider>
      <MemoryRouter>
        <SetsBrowser title="Sets" />
      </MemoryRouter>
    </SeshatProvider>,
  )

describe('SetsBrowser view toggle', () => {
  it('shows the card grid with a New set tile by default and no toggle when there are no sets', () => {
    renderBrowser()
    expect(screen.queryByTestId(TESTIDS.setsBrowserViewToggle)).not.toBeInTheDocument()
  })

  it('defaults to cards, switches to a table, and remembers the choice', async () => {
    seed()
    const user = userEvent.setup()
    const first = renderBrowser()

    expect(screen.getByRole('radio', { name: 'Card view' })).toBeChecked()
    expect(screen.queryByTestId(TESTIDS.setsBrowserTable)).not.toBeInTheDocument()
    expect(screen.getByTestId(TESTIDS.setsBrowserNewSet)).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Table view' }))

    const table = screen.getByTestId(TESTIDS.setsBrowserTable)
    const row = within(table).getByTestId(TESTIDS.setsBrowserRow)
    expect(within(row).getByRole('link', { name: 'Anatomy' })).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: 'Study Anatomy' })).toBeInTheDocument()
    expect(within(row).getByRole('progressbar', { name: /0 of 2 cards memorized/ })).toBeInTheDocument()
    expect(screen.getByTestId(TESTIDS.setsBrowserNewSet)).toHaveAttribute('href', '/sets/new')

    first.unmount()
    renderBrowser()
    expect(screen.getByRole('radio', { name: 'Table view' })).toBeChecked()
    expect(screen.getByTestId(TESTIDS.setsBrowserTable)).toBeInTheDocument()
  })

  it('is one radio group named "Set view" with exactly two options', () => {
    seed()
    renderBrowser()
    const group = screen.getByRole('radiogroup', { name: 'Set view' })
    expect(within(group).getAllByRole('radio')).toHaveLength(2)
  })
})

const seedMany = () =>
  saveState({
    ...createEmptyAppState(),
    sets: [
      { id: setId, name: 'Anatomy', description: '', tags: ['bio'], createdAt: now, updatedAt: now, goalDate: null },
      {
        id: setIdSchema.parse('b2222222-2222-4222-8222-222222222222'),
        name: 'Capitals',
        description: '',
        tags: [],
        createdAt: now,
        updatedAt: now,
        goalDate: null,
      },
    ],
    cards: [card('c1111111-1111-4111-8111-111111111111'), card('c2222222-2222-4222-8222-222222222222')],
  })

describe('SetsBrowser contents', () => {
  it('empty: starter loaders, Create and Import, but no toggle or search', () => {
    renderBrowser()
    expect(screen.getAllByTestId(TESTIDS.setsBrowserStarterLoad).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Create' })).toHaveAttribute('href', '/sets/new')
    expect(screen.getByRole('link', { name: 'Import' })).toHaveAttribute('href', '/sets/import')
    expect(screen.queryByRole('searchbox', { name: 'Search sets' })).not.toBeInTheDocument()
  })

  it('grid: each card links to the set, shows tags, counts, Study and Edit', () => {
    seedMany()
    renderBrowser()
    const cardEl = screen.getByRole('article', { name: 'Anatomy' })
    expect(within(cardEl).getByRole('link', { name: 'Anatomy' })).toHaveAttribute('href', `/sets/${setId}`)
    expect(within(cardEl).getByRole('list', { name: 'Tags' })).toHaveTextContent('bio')
    expect(within(cardEl).getByText(/2 cards/)).toBeInTheDocument()
    expect(within(cardEl).getByRole('link', { name: 'Study Anatomy' })).toHaveAttribute('href', `/sets/${setId}/study`)
    expect(within(cardEl).getByRole('link', { name: 'Edit Anatomy' })).toHaveAttribute('href', `/sets/${setId}/edit`)
    expect(screen.getByTestId(TESTIDS.setsBrowserNewSet)).toHaveAttribute('href', '/sets/new')
  })

  it('table: row shows tags, counts, Study and Edit', async () => {
    seedMany()
    const user = userEvent.setup()
    renderBrowser()
    await user.click(screen.getByRole('radio', { name: 'Table view' }))
    const row = screen.getAllByTestId(TESTIDS.setsBrowserRow)[0]!
    expect(within(row).getByRole('list', { name: 'Tags' })).toHaveTextContent('bio')
    expect(within(row).getByRole('link', { name: 'Edit Anatomy' })).toHaveAttribute('href', `/sets/${setId}/edit`)
    expect(within(row).getByRole('link', { name: 'Study Anatomy' })).toBeInTheDocument()
    expect(within(row).getAllByText('2')).not.toHaveLength(0)
  })

  it('search filters the grid and the table and reports no match', async () => {
    seedMany()
    const user = userEvent.setup()
    renderBrowser()
    const search = screen.getByRole('searchbox', { name: 'Search sets' })

    await user.type(search, 'bio')
    expect(screen.getAllByTestId(TESTIDS.setsBrowserCard)).toHaveLength(1)

    await user.click(screen.getByRole('radio', { name: 'Table view' }))
    expect(screen.getAllByTestId(TESTIDS.setsBrowserRow)).toHaveLength(1)

    await user.clear(search)
    await user.type(search, 'zzz')
    expect(screen.getByText('No sets match "zzz".')).toBeInTheDocument()
    expect(screen.queryByTestId(TESTIDS.setsBrowserTable)).not.toBeInTheDocument()
  })
})
