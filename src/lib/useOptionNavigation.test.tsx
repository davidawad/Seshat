import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OptionAnnouncer } from './OptionAnnouncer'
import { useKeybindings } from './useKeybindings'
import {
  type MoveIndexInput,
  NAV_OPTION_ATTRIBUTE,
  type NavOrientation,
  measureColumns,
  moveIndex,
  useOptionNavigation,
} from './useOptionNavigation'

afterEach(() => cleanup())

const move = (input: Partial<MoveIndexInput> & Pick<MoveIndexInput, 'direction'>) =>
  moveIndex({ count: 4, index: 0, orientation: 'vertical', ...input })

describe('moveIndex: lists', () => {
  it('vertical: up is previous, down is next, wrapping both ways', () => {
    expect(move({ direction: 'down', index: 0 })).toBe(1)
    expect(move({ direction: 'down', index: 3 })).toBe(0)
    expect(move({ direction: 'up', index: 2 })).toBe(1)
    expect(move({ direction: 'up', index: 0 })).toBe(3)
  })

  it('vertical ignores left/right; horizontal ignores up/down', () => {
    expect(move({ direction: 'left' })).toBeNull()
    expect(move({ direction: 'right' })).toBeNull()
    expect(move({ direction: 'up', orientation: 'horizontal' })).toBeNull()
    expect(move({ direction: 'down', orientation: 'horizontal' })).toBeNull()
    expect(move({ direction: 'right', orientation: 'horizontal', index: 3 })).toBe(0)
    expect(move({ direction: 'left', orientation: 'horizontal', index: 0 })).toBe(3)
  })

  it('with nothing highlighted, next-style keys land first and previous-style keys land last', () => {
    expect(move({ direction: 'down', index: null })).toBe(0)
    expect(move({ direction: 'up', index: null })).toBe(3)
    expect(move({ direction: 'right', orientation: 'horizontal', index: null })).toBe(0)
    expect(move({ direction: 'left', orientation: 'horizontal', index: null })).toBe(3)
    expect(move({ direction: 'down', index: -1 })).toBe(0)
    expect(move({ direction: 'up', index: 99 })).toBe(3)
  })

  it('count 0 is not handled; count 1 stays on the only item', () => {
    expect(move({ direction: 'down', count: 0, index: null })).toBeNull()
    expect(move({ direction: 'down', count: 1, index: 0 })).toBe(0)
    expect(move({ direction: 'up', count: 1, index: null })).toBe(0)
  })

  it('skips disabled indices in the direction of travel, and is null when all are disabled', () => {
    const isDisabled = (i: number) => i === 1 || i === 2
    expect(move({ direction: 'down', index: 0, isDisabled })).toBe(3)
    expect(move({ direction: 'up', index: 3, isDisabled })).toBe(0)
    expect(move({ direction: 'down', index: null, isDisabled: (i) => i === 0 })).toBe(1)
    expect(move({ direction: 'down', index: 0, isDisabled: () => true })).toBeNull()
  })
})

describe('moveIndex: grid', () => {
  // 7 items, 3 columns:  0 1 2 / 3 4 5 / 6 . .
  const grid = (direction: MoveIndexInput['direction'], index: number | null, extra: Partial<MoveIndexInput> = {}) =>
    moveIndex({ count: 7, index, direction, orientation: 'grid', columns: 3, ...extra })

  it('left/right step through reading order and wrap', () => {
    expect(grid('right', 2)).toBe(3)
    expect(grid('right', 6)).toBe(0)
    expect(grid('left', 0)).toBe(6)
    expect(grid('left', 4)).toBe(3)
  })

  it('up/down move by a row', () => {
    expect(grid('down', 0)).toBe(3)
    expect(grid('down', 3)).toBe(6)
    expect(grid('up', 4)).toBe(1)
  })

  it('wraps within the column, handling the ragged last row', () => {
    expect(grid('down', 6)).toBe(0) // column 0 has a cell in the last row
    expect(grid('down', 4)).toBe(1) // column 1 does not: 4+3=7 is out of range
    expect(grid('down', 5)).toBe(2)
    expect(grid('up', 0)).toBe(6)
    expect(grid('up', 1)).toBe(4)
    expect(grid('up', 2)).toBe(5)
  })

  it('treats columns below 1 (or omitted) as a single column, and starts from the ends when unhighlighted', () => {
    expect(grid('down', 1, { columns: 0 })).toBe(2)
    expect(moveIndex({ count: 3, index: 0, direction: 'down', orientation: 'grid' })).toBe(1)
    expect(grid('down', null)).toBe(0)
    expect(grid('up', null)).toBe(6)
  })

  it('skips disabled cells', () => {
    expect(grid('down', 0, { isDisabled: (i) => i === 3 })).toBe(6)
    expect(grid('right', 0, { isDisabled: (i) => i === 1 })).toBe(2)
  })
})

describe('measureColumns', () => {
  it('is 1 without a container or without a CSS grid, and counts tracks for a grid', () => {
    expect(measureColumns(null)).toBe(1)
    const el = document.createElement('div')
    expect(measureColumns(el)).toBe(1)
    const spy = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ gridTemplateColumns: '10px 10px 10px' } as CSSStyleDeclaration)
    expect(measureColumns(el)).toBe(3)
    spy.mockReturnValue({ gridTemplateColumns: '10px 10px 0px' } as CSSStyleDeclaration) // collapsed auto-fit track
    expect(measureColumns(el)).toBe(2)
    spy.mockReturnValue({ gridTemplateColumns: 'none' } as CSSStyleDeclaration)
    expect(measureColumns(el)).toBe(1)
    spy.mockRestore()
  })
})

interface HarnessProps {
  readonly orientation?: NavOrientation
  readonly enabled?: boolean
  readonly columns?: number
  readonly onConfirm?: (index: number) => void
  readonly disabledIndex?: number
}

const LABELS = ['One', 'Two', 'Three', 'Four']

const Harness = ({ orientation = 'vertical', enabled = true, columns, onConfirm, disabledIndex }: HarnessProps) => {
  const [index, setIndex] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const { setBinding, resetAll } = useKeybindings()
  useOptionNavigation({
    count: LABELS.length,
    index,
    onIndexChange: setIndex,
    onConfirm,
    orientation,
    columns,
    enabled,
    containerRef: ref,
    isDisabled: disabledIndex === undefined ? undefined : (i) => i === disabledIndex,
  })
  return (
    <div>
      <input aria-label="text" />
      <select aria-label="pick">
        <option>a</option>
      </select>
      <div ref={ref}>
        {LABELS.map((label) => (
          <span key={label} tabIndex={-1} {...{ [NAV_OPTION_ATTRIBUTE]: '' }}>
            {label}
          </span>
        ))}
      </div>
      <OptionAnnouncer index={index} labels={LABELS} />
      <p data-testid="index">{String(index)}</p>
      <button type="button">neutral</button>
      <button type="button" onClick={() => setBinding('nav.down', 'S')}>
        wasd-down
      </button>
      <button type="button" onClick={() => resetAll()}>
        reset
      </button>
    </div>
  )
}

const currentIndex = () => screen.getByTestId('index').textContent

describe('useOptionNavigation', () => {
  it('moves the highlight, focuses the option, and announces it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(currentIndex()).toBe('1')
    expect(screen.getByText('Two')).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('Option 2 of 4: Two')
  })

  it('auto-repeats movement but not confirm, and only preventDefaults handled keys', () => {
    const onConfirm = vi.fn()
    render(<Harness onConfirm={onConfirm} />)
    const press = (key: string, repeat = false) => {
      const event = new KeyboardEvent('keydown', { key, repeat, bubbles: true, cancelable: true })
      act(() => {
        window.dispatchEvent(event)
      })
      return event
    }
    expect(press('ArrowDown').defaultPrevented).toBe(true)
    expect(press('ArrowDown', true).defaultPrevented).toBe(true)
    expect(currentIndex()).toBe('1')
    expect(press('Enter', true).defaultPrevented).toBe(false)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(press('ArrowLeft').defaultPrevented).toBe(false) // not applicable to a vertical list
    expect(press('x').defaultPrevented).toBe(false)
    expect(press('Enter').defaultPrevented).toBe(true)
    expect(onConfirm).toHaveBeenCalledWith(1)
  })

  it('confirms with Space, but not with nothing highlighted or Shift held; skips disabled options', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<Harness onConfirm={onConfirm} disabledIndex={2} />)
    await user.keyboard('{Enter}')
    expect(onConfirm).not.toHaveBeenCalled()
    await user.keyboard('{ArrowDown}')
    ;(document.activeElement as HTMLElement).blur()
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    expect(onConfirm).not.toHaveBeenCalled()
    await user.keyboard(' ')
    expect(onConfirm).toHaveBeenCalledWith(0)
    await user.keyboard('{ArrowDown}{ArrowDown}') // 0 -> 1 -> (2 disabled) 3
    expect(currentIndex()).toBe('3')
  })

  it('does not confirm when the highlight itself is disabled', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const { rerender } = render(<Harness onConfirm={onConfirm} />)
    await user.keyboard('{ArrowDown}{ArrowDown}') // index 1
    ;(document.activeElement as HTMLElement).blur()
    rerender(<Harness onConfirm={onConfirm} disabledIndex={1} />)
    await user.keyboard('{Enter}')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('does not fire Enter when focus is on a button (native activation handles it)', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<Harness onConfirm={onConfirm} />)
    await user.keyboard('{ArrowDown}')
    screen.getByRole('button', { name: 'neutral' }).focus()
    await user.keyboard('{Enter}')
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('is inert while disabled, in text fields and selects, and with modifier keys', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Harness enabled={false} />)
    await user.keyboard('{ArrowDown}')
    expect(currentIndex()).toBe('null')
    rerender(<Harness />)
    await user.click(screen.getByLabelText('text'))
    await user.keyboard('{ArrowDown}')
    screen.getByLabelText('pick').focus()
    await user.keyboard('{ArrowDown}')
    expect(currentIndex()).toBe('null')
    ;(document.activeElement as HTMLElement).blur()
    await user.keyboard('{Control>}{ArrowDown}{/Control}')
    expect(currentIndex()).toBe('null')
  })

  it('supports grid orientation with explicit columns', async () => {
    const user = userEvent.setup()
    render(<Harness orientation="grid" columns={2} />)
    await user.keyboard('{ArrowRight}{ArrowDown}')
    expect(currentIndex()).toBe('2')
    await user.keyboard('{ArrowUp}')
    expect(currentIndex()).toBe('0')
  })

  it('follows a remapped navigation key and stops answering the old one', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'wasd-down' }))
    await user.keyboard('{ArrowDown}')
    expect(currentIndex()).toBe('null')
    await user.keyboard('s')
    expect(currentIndex()).toBe('0')
    await user.click(screen.getByRole('button', { name: 'reset' }))
  })
})

describe('OptionAnnouncer', () => {
  it('is empty with no highlight or an out-of-range one', () => {
    const { rerender } = render(<OptionAnnouncer index={null} labels={LABELS} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    rerender(<OptionAnnouncer index={9} labels={LABELS} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})
