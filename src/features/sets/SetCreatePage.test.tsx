import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SeshatProvider, useSeshatStore } from '../../lib/store'
import { DRAFT_STORAGE_KEY, parseDraft } from './set-draft'
import { SetCreatePage } from './SetCreatePage'

afterEach(() => cleanup())

const Probe = () => {
  const { state } = useSeshatStore()
  return (
    <ul aria-label="stored sets">
      {state.sets.map((set) => (
        <li key={set.id}>
          {set.name}|{set.description}|{set.tags.join('+')}|
          {state.cards
            .filter((card) => card.setId === set.id)
            .map((card) => card.prompt)
            .join(';')}
        </li>
      ))}
    </ul>
  )
}

const renderPage = () =>
  render(
    <SeshatProvider>
      <MemoryRouter initialEntries={['/sets/new']}>
        <Probe />
        <Routes>
          <Route path="/sets/new" element={<SetCreatePage />} />
          <Route path="/sets" element={<p>list</p>} />
          <Route path="/sets/:id" element={<p>set hub</p>} />
          <Route path="/sets/:id/study" element={<p>study page</p>} />
        </Routes>
      </MemoryRouter>
    </SeshatProvider>,
  )

type User = ReturnType<typeof userEvent.setup>

const fillRow = async (user: User, n: number, term: string, definition: string) => {
  await user.type(screen.getByRole('textbox', { name: `Term for card ${n}` }), term)
  await user.type(screen.getByRole('textbox', { name: `Definition for card ${n}` }), definition)
}

describe('SetCreatePage', () => {
  beforeEach(() => window.localStorage.clear())

  it('starts with two empty rows and never deletes the last one', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(screen.getAllByTestId('create-card-row')).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Delete card 2' }))
    expect(screen.getAllByTestId('create-card-row')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Delete card 1' })).toBeDisabled()
  })

  it('requires a title with an accessible inline error', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillRow(user, 1, 'q', 'a')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    const title = screen.getByRole('textbox', { name: 'Title' })
    expect(title).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a title')
    expect(title).toHaveAccessibleDescription('Enter a title for the set.')
    expect(title).toHaveFocus()
    expect(screen.queryByText('set hub')).toBeNull()
    await user.type(title, 'T')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('adds rows with the button and with Tab from the last definition, focusing the new term', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Add a card' }))
    expect(screen.getAllByTestId('create-card-row')).toHaveLength(3)
    expect(screen.getByRole('textbox', { name: 'Term for card 3' })).toHaveFocus()
    await user.click(screen.getByRole('textbox', { name: 'Definition for card 3' }))
    await user.tab()
    expect(screen.getAllByTestId('create-card-row')).toHaveLength(4)
    expect(screen.getByRole('textbox', { name: 'Term for card 4' })).toHaveFocus()
    // Tab from an earlier row's definition moves on normally.
    await user.click(screen.getByRole('textbox', { name: 'Definition for card 1' }))
    await user.tab()
    expect(screen.getAllByTestId('create-card-row')).toHaveLength(4)
  })

  it('Enter in a textarea inserts a newline instead of submitting', async () => {
    const user = userEvent.setup()
    renderPage()
    const term = screen.getByRole('textbox', { name: 'Term for card 1' })
    await user.type(term, 'a{Enter}b')
    expect(term).toHaveValue('a\nb')
    expect(screen.queryByText('set hub')).toBeNull()
  })

  it('warns on a one-sided row and blocks create; blank rows are ignored', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Set')
    await user.type(screen.getByRole('textbox', { name: 'Term for card 1' }), 'lonely')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Card 1 needs both')
    expect(screen.getByRole('textbox', { name: 'Definition for card 1' })).toHaveAttribute('aria-invalid', 'true')
    await user.type(screen.getByRole('textbox', { name: 'Definition for card 1' }), 'found')
    expect(screen.queryByRole('alert')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByText('set hub')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'stored sets' })).toHaveTextContent('Set|||lonely')
  })

  it('needs at least one card', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Empty')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(screen.getByRole('alert')).toHaveTextContent('at least one card')
  })

  it('creates one set with the right cards and tags, clears the draft, and opens the hub', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Capitals')
    await user.type(screen.getByRole('textbox', { name: 'Description (optional)' }), 'Cities')
    await user.type(screen.getByRole('textbox', { name: 'Tags (optional)' }), 'geo, eu, geo')
    expect(screen.getByRole('list', { name: 'Tags' }).children).toHaveLength(2)
    await fillRow(user, 1, 'France', 'Paris')
    await fillRow(user, 2, 'Spain', 'Madrid')
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByText('set hub')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'stored sets' }).children).toHaveLength(1)
    expect(screen.getByRole('list', { name: 'stored sets' })).toHaveTextContent('Capitals|Cities|geo+eu|France;Spain')
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull()
  })

  it('Create and practice goes to the study page', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'A')
    await fillRow(user, 1, 'q', 'a')
    await user.click(screen.getByRole('button', { name: 'Create and practice' }))
    expect(await screen.findByText('study page')).toBeInTheDocument()
  })

  it('Ctrl+Enter creates the set', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'B')
    await fillRow(user, 1, 'q', 'a')
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(await screen.findByText('set hub')).toBeInTheDocument()
  })

  it('saves a draft as you type and restores it after a reload', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByTestId('create-draft-status')).toHaveTextContent('')
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Half done')
    await fillRow(user, 1, 'q', 'a')
    expect(screen.getByTestId('create-draft-status')).toHaveTextContent('Draft saved')
    const stored = parseDraft(window.localStorage.getItem(DRAFT_STORAGE_KEY))
    expect(stored?.title).toBe('Half done')
    expect(stored?.rows[0]?.term).toBe('q')
    cleanup()

    renderPage()
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Half done')
    expect(screen.getByRole('textbox', { name: 'Term for card 1' })).toHaveValue('q')
    expect(screen.getByTestId('create-draft-status')).toHaveTextContent('Draft restored')
  })

  it('ignores a corrupt draft', () => {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, '{"title":5}')
    renderPage()
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('')
    expect(screen.getAllByTestId('create-card-row')).toHaveLength(2)
  })
})
