import { act, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { base, installA11yTestEnv, renderAt, seed } from '../../a11y-fixtures'
import { TESTIDS } from '../../lib/testids'
import { loadState } from '../../lib/storage'

installA11yTestEnv()

// Whole-App renders; the same explicit timeout the other app-level suites use.
vi.setConfig({ testTimeout: 60_000 })

// Real <dialog> semantics jsdom lacks: Escape dispatches `cancel`, then closes.
beforeAll(() => {
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

let confirmSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  window.localStorage.clear()
  seed()
  confirmSpy = vi.spyOn(window, 'confirm')
})
afterEach(() => {
  cleanup()
  confirmSpy.mockRestore()
})

const stored = () => {
  const result = loadState()
  if (!result.ok) throw new Error('state did not load')
  return result.value
}
const cardCount = () => stored().cards.length
// What the browser does on Escape: close the dialog, which fires `close`.
const pressEscape = (dialog: HTMLElement) => act(() => void dialog.dispatchEvent(new Event('close')))

describe('deleting a card asks in-app, never with window.confirm', () => {
  it('opens an accessible dialog focused on the safe Cancel button', async () => {
    const user = userEvent.setup()
    renderAt(`${base}/edit`)
    await user.click((await screen.findAllByTestId(TESTIDS.editCardDelete))[0]!)
    const dialog = await screen.findByTestId(TESTIDS.confirmDialog)
    expect(within(dialog).getByRole('heading', { name: 'Delete this card?' })).toBeInTheDocument()
    expect(dialog).toHaveAccessibleName('Delete this card?')
    expect(within(dialog).getByTestId(TESTIDS.confirmDialogCancel)).toHaveFocus()
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('Cancel keeps the card', async () => {
    const user = userEvent.setup()
    renderAt(`${base}/edit`)
    const before = cardCount()
    await user.click((await screen.findAllByTestId(TESTIDS.editCardDelete))[0]!)
    await user.click(await screen.findByTestId(TESTIDS.confirmDialogCancel))
    expect(screen.queryByTestId(TESTIDS.confirmDialog)).not.toBeInTheDocument()
    expect(screen.getAllByTestId(TESTIDS.editCardDelete).length).toBeGreaterThan(0)
    expect(cardCount()).toBe(before)
  })

  it('Escape cancels and keeps the card', async () => {
    const user = userEvent.setup()
    renderAt(`${base}/edit`)
    const before = cardCount()
    await user.click((await screen.findAllByTestId(TESTIDS.editCardDelete))[0]!)
    const dialog = await screen.findByTestId(TESTIDS.confirmDialog)
    pressEscape(dialog)
    expect(screen.queryByTestId(TESTIDS.confirmDialog)).not.toBeInTheDocument()
    expect(cardCount()).toBe(before)
  })

  it('the destructive button deletes the card', async () => {
    const user = userEvent.setup()
    renderAt(`${base}/edit`)
    const before = cardCount()
    await user.click((await screen.findAllByTestId(TESTIDS.editCardDelete))[0]!)
    await user.click(await screen.findByTestId(TESTIDS.confirmDialogAccept))
    expect(screen.queryByTestId(TESTIDS.confirmDialog)).not.toBeInTheDocument()
    await vi.waitFor(() => expect(cardCount()).toBe(before - 1))
  })
})

describe('deleting a set asks in-app, never with window.confirm', () => {
  it('Cancel keeps the set and stays on the edit page', async () => {
    const user = userEvent.setup()
    renderAt(`${base}/edit`)
    await user.click(await screen.findByTestId(TESTIDS.editDeleteSet))
    const dialog = await screen.findByTestId(TESTIDS.confirmDialog)
    expect(within(dialog).getByText('Capitals')).toBeInTheDocument()
    expect(within(dialog).getByTestId(TESTIDS.confirmDialogCancel)).toHaveFocus()
    await user.click(within(dialog).getByTestId(TESTIDS.confirmDialogCancel))
    expect(screen.getByTestId(TESTIDS.editPage)).toBeInTheDocument()
    expect(stored().sets).toHaveLength(1)
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it('Escape keeps the set', async () => {
    const user = userEvent.setup()
    renderAt(`${base}/edit`)
    await user.click(await screen.findByTestId(TESTIDS.editDeleteSet))
    const dialog = await screen.findByTestId(TESTIDS.confirmDialog)
    pressEscape(dialog)
    expect(screen.queryByTestId(TESTIDS.confirmDialog)).not.toBeInTheDocument()
    expect(stored().sets).toHaveLength(1)
  })

  it('confirming deletes the set and leaves for /sets', async () => {
    const user = userEvent.setup()
    renderAt(`${base}/edit`)
    await user.click(await screen.findByTestId(TESTIDS.editDeleteSet))
    await user.click(await screen.findByTestId(TESTIDS.confirmDialogAccept))
    await vi.waitFor(() => expect(stored().sets).toHaveLength(0))
    expect(screen.queryByTestId(TESTIDS.editPage)).not.toBeInTheDocument()
  })
})
