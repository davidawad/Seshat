import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SeshatProvider } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import type { Catalog, CatalogEntry } from './catalog'
import { SetBrowsePage } from './SetBrowsePage'

const entry = (id: string, category: string, name: string): CatalogEntry => ({
  id,
  category,
  name,
  description: `${name} blurb`,
  cardCount: 1,
  set: {
    seshatExportVersion: 1,
    name,
    description: '',
    tags: [],
    cards: [
      {
        prompt: 'q',
        promptImage: null,
        content: { kind: 'short-answer', answer: 'a', acceptableAnswers: [], answerImage: null },
        explanation: null,
        sourceRef: null,
        tags: [],
      },
    ],
  },
})

const catalog: Catalog = {
  entries: [entry('1', 'law', 'Torts'), entry('2', 'science', 'Cells')],
  categories: [
    { slug: 'law', label: 'Law', blurb: '', count: 1 },
    { slug: 'science', label: 'Science', blurb: '', count: 1 },
  ],
  errors: [],
}
let current: Catalog = catalog
vi.mock('./useCatalog', () => ({ useCatalog: () => current }))

const renderAt = (url: string) =>
  render(
    <SeshatProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/sets/browse" element={<SetBrowsePage />} />
        </Routes>
      </MemoryRouter>
    </SeshatProvider>,
  )

afterEach(() => cleanup())
beforeEach(() => {
  window.localStorage.clear()
  current = catalog
})

describe('SetBrowsePage', () => {
  it('lists all sets and filters by category chip', async () => {
    const user = userEvent.setup()
    renderAt('/sets/browse')
    expect(screen.getAllByTestId(TESTIDS.browseCard)).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: /^Science/ }))
    const cards = screen.getAllByTestId(TESTIDS.browseCard)
    expect(cards).toHaveLength(1)
    expect(within(cards[0]!).getByText('Cells')).toBeTruthy()
  })

  it('honors ?category= on load', () => {
    renderAt('/sets/browse?category=law')
    expect(screen.getAllByTestId(TESTIDS.browseCard)).toHaveLength(1)
    expect(screen.getByRole('button', { name: /^Law/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('adds a whole category as a folder, reusing sets already owned', async () => {
    const user = userEvent.setup()
    renderAt('/sets/browse?category=law')
    await user.click(screen.getByTestId(TESTIDS.browseAdd))
    await user.click(screen.getByTestId(TESTIDS.browseAddFolder))
    expect(await screen.findByTestId(TESTIDS.browseOpenFolder)).toBeTruthy()
    const saved = JSON.parse(window.localStorage.getItem('seshat:app-state:v2') ?? '{}')
    expect(saved.sets).toHaveLength(1)
    expect(saved.folders).toHaveLength(1)
    expect(saved.folders[0].name).toBe('Law')
    expect(saved.folders[0].setIds).toEqual([saved.sets[0].id])
  })

  it('adds a set once, then shows Added and Open instead of a second Add', async () => {
    const user = userEvent.setup()
    renderAt('/sets/browse?category=law')
    await user.click(screen.getByRole('button', { name: 'Add Torts to my sets' }))
    expect(await screen.findByText('Added')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Add Torts/ })).toBeNull()
    expect(screen.getByRole('link', { name: 'Open Torts' }).getAttribute('href')).toMatch(/^\/sets\//)
  })

  it('shows an empty state for a category with no sets', () => {
    renderAt('/sets/browse?category=nope')
    expect(screen.getByTestId(TESTIDS.browseEmpty)).toBeTruthy()
  })

  it('surfaces load errors', () => {
    current = { ...catalog, errors: [{ path: 'law/bad.json', message: 'broken' }] }
    renderAt('/sets/browse')
    expect(screen.getByTestId(TESTIDS.browseErrors).textContent).toContain('law/bad.json')
  })
})
