import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ShortcutHelp } from './ShortcutHelp'

// @testing-library/react's auto-cleanup needs a global `afterEach`, which
// this project doesn't enable (no `test.globals: true` in vite.config.ts) —
// without this, DOM from one test leaks into the next.
afterEach(() => cleanup())

const shortcuts = [
  { key: '/', label: 'Focus search' },
  { key: 'Enter', label: 'Submit' },
]

describe('ShortcutHelp', () => {
  it('renders collapsed by default, with the legend content already in the DOM', () => {
    render(<ShortcutHelp shortcuts={shortcuts} />)

    const summary = screen.getByText('Keyboard shortcuts')
    const details = summary.closest('details')
    expect(details).not.toBeNull()
    expect(details).not.toHaveAttribute('open')

    expect(screen.getByText('Focus search')).toBeInTheDocument()
    expect(screen.getByText('Submit')).toBeInTheDocument()
  })

  it('expands to show the shortcut legend when the summary is clicked', async () => {
    const user = userEvent.setup()
    render(<ShortcutHelp shortcuts={shortcuts} />)

    const summary = screen.getByText('Keyboard shortcuts')
    const details = summary.closest('details')
    if (details === null) throw new Error('expected a <details> ancestor')

    await user.click(summary)

    expect(details).toHaveAttribute('open')
  })

  it('renders one entry per shortcut, pairing its key (in a <kbd>) with its label', () => {
    render(<ShortcutHelp shortcuts={shortcuts} />)

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(shortcuts.length)

    shortcuts.forEach((shortcut, index) => {
      const item = items[index]!
      const kbd = item.querySelector('kbd')
      expect(kbd).not.toBeNull()
      expect(kbd?.textContent).toBe(shortcut.key)
      expect(item.textContent).toContain(shortcut.label)
    })
  })

  it('renders no entries when given an empty shortcut list', () => {
    render(<ShortcutHelp shortcuts={[]} />)
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })
})
