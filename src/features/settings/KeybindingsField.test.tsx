import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useKeybindings } from '../../lib/useKeybindings'
import { KeybindingsField } from './KeybindingsField'

// @testing-library/react's auto-cleanup needs a global `afterEach`, which
// this project doesn't enable (no `test.globals: true` in vite.config.ts) —
// without this, DOM from one test leaks into the next.
afterEach(() => cleanup())

const downloadJsonMock = vi.fn<(filename: string, data: unknown) => void>()
vi.mock('../sets/download', () => ({
  downloadJson: (filename: string, data: unknown) => downloadJsonMock(filename, data),
}))

/** Resets `useKeybindings`'s module-level singleton for real (see useKeybindings.test.tsx for why clearing localStorage alone isn't enough). */
const ResetHelper = () => {
  const { resetAll } = useKeybindings()
  return <button onClick={() => resetAll()}>reset-store</button>
}

const resetKeybindingsStore = () => {
  const { getByText, unmount } = render(<ResetHelper />)
  act(() => getByText('reset-store').click())
  unmount()
}

/** Finds a specific action's row by its visible label text. */
const rowFor = (label: string): HTMLElement => screen.getByText(label).closest('.keybinding-row') as HTMLElement

describe('KeybindingsField', () => {
  beforeEach(() => {
    window.localStorage.clear()
    downloadJsonMock.mockClear()
    resetKeybindingsStore()
  })

  it('renders one row per registered action, showing its default key', () => {
    render(<KeybindingsField />)
    const row = rowFor('Flip card')
    expect(within(row).getByText('Space')).toBeInTheDocument()
  })

  it('groups actions under a scope heading', () => {
    render(<KeybindingsField />)
    expect(screen.getByText('Flashcards')).toBeInTheDocument()
    expect(screen.getByText('Match')).toBeInTheDocument()
  })

  it('recording a new key updates the row and disables-to-enables the Reset button', async () => {
    const user = userEvent.setup()
    render(<KeybindingsField />)
    const row = rowFor('Flip card')

    expect(within(row).getByText('Reset')).toBeDisabled()

    await user.click(within(row).getByText('Change'))
    expect(within(row).getByText(/press a key/i)).toBeInTheDocument()

    await user.keyboard('{Enter}')

    expect(within(row).getByText('Enter')).toBeInTheDocument()
    expect(within(row).getByText('Reset')).toBeEnabled()
  })

  it('Escape cancels recording without changing the binding', async () => {
    const user = userEvent.setup()
    render(<KeybindingsField />)
    const row = rowFor('Flip card')

    await user.click(within(row).getByText('Change'))
    await user.keyboard('{Escape}')

    expect(within(row).getByText('Space')).toBeInTheDocument()
    expect(within(row).getByText('Change')).toBeInTheDocument()
  })

  it('refuses a remap that would collide with another action already bound to that key in the same scope', async () => {
    const user = userEvent.setup()
    render(<KeybindingsField />)
    // "Grade: Don't know (once flipped)" defaults to '1'; try to also bind
    // "Grade: Know (once flipped)" (defaults to '2') to '1'.
    const knowRow = rowFor('Grade: Know (once flipped)')

    await user.click(within(knowRow).getByText('Change'))
    await user.keyboard('1')

    expect(within(knowRow).getByText('2')).toBeInTheDocument() // unchanged
    expect(within(knowRow).getByRole('status')).toHaveTextContent(/already used by/i)
  })

  it('Reset reverts a single overridden row to its default', async () => {
    const user = userEvent.setup()
    render(<KeybindingsField />)
    const row = rowFor('Flip card')

    await user.click(within(row).getByText('Change'))
    await user.keyboard('{Enter}')
    expect(within(row).getByText('Enter')).toBeInTheDocument()

    await user.click(within(row).getByText('Reset'))
    expect(within(row).getByText('Space')).toBeInTheDocument()
  })

  it('Reset all to defaults reverts every override', async () => {
    const user = userEvent.setup()
    render(<KeybindingsField />)
    const row = rowFor('Flip card')

    await user.click(within(row).getByText('Change'))
    await user.keyboard('{Enter}')
    expect(within(row).getByText('Enter')).toBeInTheDocument()

    await user.click(screen.getByText('Reset all to defaults'))
    expect(within(row).getByText('Space')).toBeInTheDocument()
  })

  it('Download shortcuts as JSON downloads the current override map', async () => {
    const user = userEvent.setup()
    render(<KeybindingsField />)
    const row = rowFor('Flip card')
    await user.click(within(row).getByText('Change'))
    await user.keyboard('{Enter}')

    await user.click(screen.getByText('Download shortcuts as JSON'))

    expect(downloadJsonMock).toHaveBeenCalledWith('seshat-keybindings.json', { 'flashcards.flip': 'Enter' })
  })

  it('uploading a valid shortcuts JSON file applies it and reports success', async () => {
    const user = userEvent.setup()
    render(<KeybindingsField />)

    const file = new File([JSON.stringify({ 'flashcards.flip': 'Enter' })], 'shortcuts.json', {
      type: 'application/json',
    })
    await user.upload(screen.getByLabelText('Upload shortcuts JSON'), file)

    expect(await screen.findByText(/applied 1 shortcut/i)).toBeInTheDocument()
    const row = rowFor('Flip card')
    expect(within(row).getByText('Enter')).toBeInTheDocument()
  })

  it('uploading invalid JSON reports an error and applies nothing', async () => {
    const user = userEvent.setup()
    render(<KeybindingsField />)

    const file = new File(['not json'], 'shortcuts.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('Upload shortcuts JSON'), file)

    expect(await screen.findByRole('alert')).toHaveTextContent(/not valid JSON/i)
    const row = rowFor('Flip card')
    expect(within(row).getByText('Space')).toBeInTheDocument()
  })

  it('uploading JSON with only unknown action ids applies nothing but still reports what was ignored', async () => {
    const user = userEvent.setup()
    render(<KeybindingsField />)

    const file = new File([JSON.stringify({ 'not.a.real.action': '1' })], 'shortcuts.json', {
      type: 'application/json',
    })
    await user.upload(screen.getByLabelText('Upload shortcuts JSON'), file)

    expect(await screen.findByRole('status')).toHaveTextContent(/applied 0 shortcuts.*ignored 1.*not\.a\.real\.action/i)
  })

  it('uploading JSON with no entries at all reports an error', async () => {
    const user = userEvent.setup()
    render(<KeybindingsField />)

    const file = new File([JSON.stringify({})], 'shortcuts.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('Upload shortcuts JSON'), file)

    expect(await screen.findByRole('alert')).toHaveTextContent(/no recognizable shortcut entries/i)
  })
})
