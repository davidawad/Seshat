import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TESTIDS } from '../../lib/testids'
import { setIdSchema } from '../../types'
import { rowMatchesFilter } from './set-table-filter'
import { SetTable, type SetTableRow } from './SetTable'

const stamp = '2026-01-01T00:00:00.000Z'

const row = (n: number, name: string, tags: string[], counts: readonly [number, number, number]): SetTableRow => ({
  set: {
    id: setIdSchema.parse('a' + n + '111111-1111-4111-8111-111111111111'),
    name,
    description: '',
    tags,
    createdAt: stamp,
    updatedAt: stamp,
    goalDate: null,
  },
  mastery: {
    total: counts[0],
    memorized: counts[1],
    due: counts[2],
    newCount: counts[0] - counts[1] - counts[2],
    lastStudied: null,
  },
})

const ROWS: readonly SetTableRow[] = [
  row(1, 'Bones', ['anatomy'], [10, 2, 1]),
  row(2, 'apples', ['fruit', 'food'], [30, 15, 5]),
  row(3, 'Cranial nerves', ['anatomy', 'neuro'], [20, 20, 0]),
]

const renderTable = (rows: readonly SetTableRow[] = ROWS) =>
  render(
    <MemoryRouter>
      <SetTable rows={rows} />
    </MemoryRouter>,
  )

const names = () =>
  screen
    .getAllByTestId(TESTIDS.setsBrowserRow)
    .map((r) => within(r).getByTestId(TESTIDS.setsBrowserSetLink).textContent)

const header = (name: string) => screen.getByRole('columnheader', { name: new RegExp(name) })
const sortButton = (name: string) => within(header(name)).getByRole('button')
const filterBox = () => screen.getByRole('searchbox', { name: /filter/i })

const typeFilter = (value: string) => fireEvent.change(filterBox(), { target: { value } })
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('SetTable structure', () => {
  it('keeps the testids, Study and Edit actions and row-header names', () => {
    renderTable()
    expect(screen.getByTestId(TESTIDS.setsBrowserTable)).toBeInTheDocument()
    expect(names()).toEqual(['Bones', 'apples', 'Cranial nerves'])
    const first = screen.getAllByTestId(TESTIDS.setsBrowserRow)[0]!
    expect(within(first).getByRole('rowheader')).toHaveTextContent('Bones')
    const studyHref = '/sets/' + ROWS[0]!.set.id + '/study'
    expect(within(first).getByRole('link', { name: 'Study Bones' })).toHaveAttribute('href', studyHref)
    expect(within(first).getByRole('link', { name: 'Edit Bones' })).toBeInTheDocument()
    expect(screen.getByTestId(TESTIDS.setsBrowserNewSet)).toHaveAttribute('href', '/sets/new')
  })

  it('makes every data column sortable but not the actions column', () => {
    renderTable()
    for (const label of ['Set', 'Memorized', 'Due', 'New', 'Cards']) {
      expect(sortButton(label)).toBeInTheDocument()
      expect(header(label)).toHaveAttribute('aria-sort', 'none')
    }
    const actions = screen.getByRole('columnheader', { name: 'Actions' })
    expect(within(actions).queryByRole('button')).not.toBeInTheDocument()
    expect(actions).not.toHaveAttribute('aria-sort')
  })
})

describe('SetTable sorting', () => {
  it('cycles ascending, descending, then back to the original order', async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(sortButton('Cards'))
    expect(names()).toEqual(['Bones', 'Cranial nerves', 'apples'])
    expect(header('Cards')).toHaveAttribute('aria-sort', 'ascending')

    await user.click(sortButton('Cards'))
    expect(names()).toEqual(['apples', 'Cranial nerves', 'Bones'])
    expect(header('Cards')).toHaveAttribute('aria-sort', 'descending')

    await user.click(sortButton('Cards'))
    expect(names()).toEqual(['Bones', 'apples', 'Cranial nerves'])
    expect(header('Cards')).toHaveAttribute('aria-sort', 'none')
  })

  it('sorts names case-insensitively', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(sortButton('Set'))
    expect(names()).toEqual(['apples', 'Bones', 'Cranial nerves'])
  })

  it('sorts Memorized by percentage, not by raw count', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(sortButton('Memorized'))
    expect(names()).toEqual(['Bones', 'apples', 'Cranial nerves'])
    await user.click(sortButton('Memorized'))
    expect(names()).toEqual(['Cranial nerves', 'apples', 'Bones'])
  })

  it('sorts numeric columns numerically', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(sortButton('Due'))
    expect(names()).toEqual(['Cranial nerves', 'Bones', 'apples'])
  })

  it('sorts by one column at a time and clears the previous indicator', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(sortButton('Cards'))
    await user.click(sortButton('Set'))
    expect(header('Cards')).toHaveAttribute('aria-sort', 'none')
    expect(header('Set')).toHaveAttribute('aria-sort', 'ascending')
  })
})

describe('SetTable sorting affordances', () => {
  it('shows a visible direction indicator', async () => {
    const user = userEvent.setup()
    renderTable()
    const indicator = () => within(sortButton('Cards')).getByText(/[▲▼⇅]/)
    expect(indicator()).toHaveTextContent('⇅')
    await user.click(sortButton('Cards'))
    expect(indicator()).toHaveTextContent('▲')
    await user.click(sortButton('Cards'))
    expect(indicator()).toHaveTextContent('▼')
  })

  it('keeps the sort when the filter changes', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.click(sortButton('Set'))
    await user.type(filterBox(), 'anatomy')
    await vi.waitFor(() => expect(names()).toEqual(['Bones', 'Cranial nerves']))
    expect(header('Set')).toHaveAttribute('aria-sort', 'ascending')
  })
})

describe('SetTable keyboard', () => {
  it('is operable from the keyboard with Enter and Space', async () => {
    const user = userEvent.setup()
    renderTable()
    await user.tab()
    await user.tab()
    expect(sortButton('Set')).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(header('Set')).toHaveAttribute('aria-sort', 'ascending')
    await user.keyboard(' ')
    expect(header('Set')).toHaveAttribute('aria-sort', 'descending')
    expect(names()).toEqual(['Cranial nerves', 'Bones', 'apples'])
  })
})

describe('SetTable filtering', () => {
  it('filters by tag and by name only after the 150ms debounce', () => {
    vi.useFakeTimers()
    renderTable()

    typeFilter('fruit')
    expect(names()).toHaveLength(3)
    advance(149)
    expect(names()).toHaveLength(3)
    advance(1)
    expect(names()).toEqual(['apples'])

    typeFilter('CRAN')
    advance(150)
    expect(names()).toEqual(['Cranial nerves'])
  })

  it('applies only the last keystroke of a burst', () => {
    vi.useFakeTimers()
    renderTable()
    for (const value of ['a', 'an', 'ana']) {
      typeFilter(value)
      advance(100)
      expect(names()).toHaveLength(3)
    }
    advance(50)
    expect(names()).toEqual(['Bones', 'Cranial nerves'])
  })

  it('restores all rows when cleared and shows an empty state on no match', () => {
    vi.useFakeTimers()
    renderTable()
    typeFilter('zzz')
    advance(150)
    expect(screen.queryAllByTestId(TESTIDS.setsBrowserRow)).toHaveLength(0)
    expect(screen.getByText('No sets match "zzz".')).toBeInTheDocument()
    expect(screen.getByTestId(TESTIDS.setsBrowserNewSet)).toBeInTheDocument()

    typeFilter('')
    advance(150)
    expect(names()).toHaveLength(3)
  })
})

describe('rowMatchesFilter', () => {
  const bones = ROWS[0]!
  it.each([
    ['', true],
    ['   ', true],
    ['bon', true],
    ['BONES', true],
    ['  anat ', true],
    ['neuro', false],
    ['10', false],
  ])('filter %j', (filter, expected) => {
    expect(rowMatchesFilter(bones, filter)).toBe(expected)
  })
})
