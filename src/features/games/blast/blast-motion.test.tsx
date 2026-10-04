import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TESTIDS } from '../../../lib/testids'
import type { CardId, SetId } from '../../../types'
import { BlastSession } from './BlastSession'
import { BOB, BUMP, ENTER, LEAVE, SHAKE, rockClassName, useBump } from './blast-motion'

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(HTMLElement.prototype, 'animate')
  delete document.documentElement.dataset['reducedMotion']
  vi.useRealTimers()
})

describe('rockClassName', () => {
  it('maps each answer state to a wrapper class', () => {
    expect(rockClassName('playing', false, true)).toBe('blast-rock')
    expect(rockClassName('correct', true, true)).toBe('blast-rock is-blasted')
    expect(rockClassName('wrong', true, false)).toBe('blast-rock is-shaken')
    expect(rockClassName('wrong', false, true)).toBe('blast-rock')
    expect(rockClassName('timeout', false, false)).toBe('blast-rock')
  })
})

const Counter = ({ value }: { value: number }) => {
  const ref = useRef<HTMLParagraphElement>(null)
  useBump(ref, value)
  return <p ref={ref}>{value}</p>
}

describe('useBump', () => {
  const stub = () => {
    const animate = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate })
    return animate
  }
  beforeEach(() => {
    delete document.documentElement.dataset['reducedMotion']
  })

  it('does not animate the first render, then bumps on change', () => {
    const animate = stub()
    const { rerender } = render(<Counter value={0} />)
    expect(animate).not.toHaveBeenCalled()
    rerender(<Counter value={1} />)
    expect(animate).toHaveBeenCalledWith(...BUMP)
    rerender(<Counter value={1} />)
    expect(animate).toHaveBeenCalledTimes(1)
  })

  it('skips the bump for reduced motion', () => {
    const animate = stub()
    document.documentElement.dataset['reducedMotion'] = 'true'
    const { rerender } = render(<Counter value={0} />)
    rerender(<Counter value={1} />)
    expect(animate).not.toHaveBeenCalled()
  })

  it('is a no-op without the Web Animations API', () => {
    const { rerender } = render(<Counter value={0} />)
    expect(() => rerender(<Counter value={1} />)).not.toThrow()
  })
})

const pairs = ['a', 'b', 'c', 'd', 'e'].map((x) => ({ cardId: x as CardId, front: `f-${x}`, back: `b-${x}` }))

describe('BlastSession motion', () => {
  it('marks motion on, wraps rocks, and still commits the outcome and advances on timers', async () => {
    vi.useFakeTimers()
    render(<BlastSession setId={'s' as SetId} pairs={pairs} />)
    const session = document.querySelector('.blast-session')
    expect(session).toHaveAttribute('data-motion', 'on')
    expect(document.querySelectorAll('.blast-rock')).toHaveLength(4)

    const options = screen.getAllByTestId(TESTIDS.blastOption)
    await act(async () => {
      options[0]?.click()
    })
    expect(document.querySelectorAll('.is-blasted, .is-shaken')).toHaveLength(1)

    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(document.querySelectorAll('.is-blasted, .is-shaken')).toHaveLength(0)
    expect(screen.getByTestId(TESTIDS.blastFeedback)).toHaveTextContent('')
  })

  it('pops in and bobs each rock, then leaves after an answer, via WAAPI', async () => {
    const cancel = vi.fn()
    const animate = vi.fn(() => ({ cancel }))
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate })
    render(<BlastSession setId={'s' as SetId} pairs={pairs} />)
    // 4 pop-ins + 4 bobs on mount.
    expect(animate).toHaveBeenCalledTimes(8)
    expect(animate).toHaveBeenCalledWith(...ENTER(3))
    expect(animate).toHaveBeenCalledWith(...BOB(2))

    await act(async () => {
      screen.getAllByTestId(TESTIDS.blastOption)[0]?.click()
    })
    expect(cancel).toHaveBeenCalledTimes(4)
    expect(animate).toHaveBeenCalledWith(...LEAVE)
    const shook = document.querySelector('.is-shaken') !== null
    expect(animate.mock.calls.some((call) => (call as unknown[])[0] === SHAKE[0])).toBe(shook)
  })

  it('does not animate under reduced motion', () => {
    const animate = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate })
    document.documentElement.dataset['reducedMotion'] = 'true'
    render(<BlastSession setId={'s' as SetId} pairs={pairs} />)
    expect(animate).not.toHaveBeenCalled()
  })

  it('leaves motion off under reduced motion', () => {
    document.documentElement.dataset['reducedMotion'] = 'true'
    render(<BlastSession setId={'s' as SetId} pairs={pairs} />)
    expect(document.querySelector('.blast-session')).not.toHaveAttribute('data-motion')
  })

  it('keeps the option click path working', async () => {
    render(<BlastSession setId={'s' as SetId} pairs={pairs} />)
    await userEvent.setup().click(screen.getAllByTestId(TESTIDS.blastOption)[0] as HTMLElement)
    expect(screen.getByTestId(TESTIDS.blastFeedback).textContent).not.toBe('')
  })
})
