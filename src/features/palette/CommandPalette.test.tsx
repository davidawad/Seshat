import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { base, installA11yTestEnv, renderAt, seed } from '../../a11y-fixtures'
import { TESTIDS } from '../../lib/testids'

installA11yTestEnv()

// cmdk scrolls the highlighted item into view and watches the list's size.
beforeAll(() => {
  Element.prototype.scrollIntoView ??= () => undefined
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

beforeEach(() => {
  window.localStorage.clear()
  seed()
})

type User = ReturnType<typeof userEvent.setup>

const CTRL_K = '{Control>}k{/Control}'

const openWith = async (user: User, chord: string) => {
  await user.keyboard(chord)
  return screen.findByRole('dialog', { name: 'Command menu' })
}

const typeQuery = async (user: User, text: string) => {
  await user.type(screen.getByTestId(TESTIDS.paletteInput), text)
}

const itemNames = (dialog: HTMLElement) =>
  within(dialog)
    .getAllByRole('option')
    .map((option) => option.querySelector('.palette-item-label')?.textContent)

describe('command palette', () => {
  it.each([
    ['Ctrl+K', CTRL_K],
    ['Meta+K', '{Meta>}k{/Meta}'],
  ])('opens on %s', async (_name, chord) => {
    const user = userEvent.setup()
    renderAt('/')
    const dialog = await openWith(user, chord)
    expect(dialog).toHaveAttribute('open')
    expect(within(dialog).getByRole('combobox')).toBeInTheDocument()
    expect(within(dialog).getByRole('listbox')).toBeInTheDocument()
    expect(itemNames(dialog)).toEqual(expect.arrayContaining(['Home', 'Open Settings', 'Capitals', 'Study Capitals']))
  })

  it('opens from inside a text field', async () => {
    const user = userEvent.setup()
    renderAt(`${base}/study`)
    await user.click(await screen.findByTestId(TESTIDS.studyAnswerInput))
    await openWith(user, CTRL_K)
    expect(screen.getByTestId(TESTIDS.paletteInput)).toHaveFocus()
  })

  it('closes when the dialog closes (Escape)', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const dialog = await openWith(user, CTRL_K)
    // jsdom has no native Escape-to-close; fire the dialog's own close event, which Escape triggers.
    await act(async () => {
      dialog.dispatchEvent(new Event('close'))
    })
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'))
  })

  it('toggles closed on a second Ctrl+K', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const dialog = await openWith(user, CTRL_K)
    await user.keyboard(CTRL_K)
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'))
  })

  it('filters as you type, with keywords, and shows an empty state and result count', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const dialog = await openWith(user, CTRL_K)
    await typeQuery(user, 'preferences')
    expect(itemNames(dialog)).toEqual(['Open Settings'])
    expect(screen.getByTestId(TESTIDS.paletteStatus)).toHaveTextContent('1 result')
    await user.clear(screen.getByTestId(TESTIDS.paletteInput))
    await typeQuery(user, 'zzzzqqq')
    expect(screen.getByTestId(TESTIDS.paletteEmpty)).toHaveTextContent('No results')
    expect(screen.getByTestId(TESTIDS.paletteStatus)).toHaveTextContent('No results')
  })

  it('Enter navigates to the top match and closes the palette', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const dialog = await openWith(user, CTRL_K)
    await typeQuery(user, 'stats{Enter}')
    expect(await screen.findByTestId(TESTIDS.statsPage)).toBeInTheDocument()
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'))
  })

  it('arrow keys move the selection', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const dialog = await openWith(user, CTRL_K)
    const selected = () =>
      within(dialog)
        .getAllByRole('option')
        .findIndex((option) => option.getAttribute('aria-selected') === 'true')
    expect(selected()).toBe(0)
    await user.keyboard('{ArrowDown}')
    expect(selected()).toBe(1)
  })

  it('opens a set study page from its Study entry', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await openWith(user, CTRL_K)
    await typeQuery(user, 'study capitals{Enter}')
    expect(await screen.findByTestId(TESTIDS.studyPage)).toBeInTheDocument()
  })

  it('Open Settings opens the settings modal', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await openWith(user, CTRL_K)
    await typeQuery(user, 'open settings{Enter}')
    expect(await screen.findByRole('dialog', { name: 'Settings' })).toHaveAttribute('open')
  })

  it('Keyboard shortcuts opens the shortcuts modal, which lists the new binding', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await openWith(user, CTRL_K)
    await typeQuery(user, 'keyboard shortcuts{Enter}')
    const shortcuts = await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })
    expect(within(shortcuts).getAllByText('Open command menu (Ctrl/Cmd + K)').length).toBeGreaterThan(0)
  })

  it('Toggle theme cycles system, light, dark', async () => {
    const user = userEvent.setup()
    renderAt('/')
    for (const expected of ['light', 'dark', 'system']) {
      const dialog = await openWith(user, CTRL_K)
      await typeQuery(user, 'toggle theme{Enter}')
      await waitFor(() => expect(dialog).not.toHaveAttribute('open'))
      await openWith(user, CTRL_K)
      const row = screen.getAllByRole('option').find((option) => option.textContent?.startsWith('Toggle theme'))
      expect(row).toHaveTextContent(expected)
      await user.keyboard(CTRL_K)
    }
  })

  it('starts with an empty query every time it opens', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await openWith(user, CTRL_K)
    await typeQuery(user, 'abc')
    await user.keyboard(CTRL_K)
    await openWith(user, CTRL_K)
    expect(screen.getByTestId(TESTIDS.paletteInput)).toHaveValue('')
  })
})
