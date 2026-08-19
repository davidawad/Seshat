import { cleanup, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useNumberedShortcut } from './useNumberedShortcut'

// @testing-library/react's auto-cleanup needs a global `afterEach`, which
// this project doesn't enable (no `test.globals: true` in vite.config.ts) —
// without this, DOM from one test leaks into the next.
afterEach(() => cleanup())

interface HarnessProps {
  readonly actionPrefix: string
  readonly count: number
  readonly active: boolean
  readonly onSelect: (index: number) => void
  readonly withTextInput?: boolean
}

/** `match.selectTile1`/`2`/`3` are real registry actions (defaults '1'/'2'/'3') — reused here as a stand-in for any numbered-action prefix. */
const Harness = ({ actionPrefix, count, active, onSelect, withTextInput = false }: HarnessProps) => {
  useNumberedShortcut(actionPrefix, count, active, onSelect)
  return withTextInput ? <input aria-label="distractor input" /> : null
}

describe('useNumberedShortcut', () => {
  it('calls onSelect with the 0-based index of the matched action when its default key is pressed', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn<(index: number) => void>()
    render(<Harness actionPrefix="match.selectTile" count={3} active onSelect={onSelect} />)

    await user.keyboard('2')

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(1) // 'match.selectTile2' defaults to '2', 0-based index 1
  })

  it('does not fire for a key past `count`', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn<(index: number) => void>()
    render(<Harness actionPrefix="match.selectTile" count={2} active onSelect={onSelect} />)

    await user.keyboard('3') // 'match.selectTile3' exists in the registry, but count=2 excludes it

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('does not fire for an unrelated key', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn<(index: number) => void>()
    render(<Harness actionPrefix="match.selectTile" count={3} active onSelect={onSelect} />)

    await user.keyboard('z')

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('does nothing while `active` is false', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn<(index: number) => void>()
    render(<Harness actionPrefix="match.selectTile" count={3} active={false} onSelect={onSelect} />)

    await user.keyboard('1')

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('is skipped while a text input is focused', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn<(index: number) => void>()
    render(<Harness actionPrefix="match.selectTile" count={3} active onSelect={onSelect} withTextInput />)

    await user.click(document.querySelector('input')!)
    await user.keyboard('1')

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('ignores a held-down repeat keydown', () => {
    const onSelect = vi.fn<(index: number) => void>()
    render(<Harness actionPrefix="match.selectTile" count={3} active onSelect={onSelect} />)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', repeat: true }))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('removes its listener on unmount', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn<(index: number) => void>()
    const { unmount } = render(<Harness actionPrefix="match.selectTile" count={3} active onSelect={onSelect} />)

    unmount()
    await user.keyboard('1')

    expect(onSelect).not.toHaveBeenCalled()
  })
})
