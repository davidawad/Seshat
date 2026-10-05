import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TESTIDS } from '../../lib/testids'
import { makeCard, makeHandlers, renderSession, seedStore, sessionElement } from './session-test-helpers'

afterEach(() => cleanup())

describe('FlashcardSession grade animation', () => {
  // jsdom has no Web Animations API; a stub whose `finished` we resolve by hand.
  const stubAnimate = () => {
    let finish!: () => void
    const finished = new Promise<void>((resolve) => {
      finish = resolve
    })
    const animate = vi.fn((..._args: unknown[]) => ({ finished }))
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate })
    return { animate, finish }
  }

  beforeEach(() => {
    window.localStorage.clear()
    delete document.documentElement.dataset['reducedMotion']
  })

  afterEach(() => {
    Reflect.deleteProperty(HTMLElement.prototype, 'animate')
    delete document.documentElement.dataset['reducedMotion']
  })

  const settle = async (finish: () => void) => {
    await act(async () => {
      finish()
      await Promise.resolve()
    })
  }

  it('shows the colored badge and an already-incremented tally, then grades when the animation ends', async () => {
    const card = makeCard()
    seedStore(card)
    const { animate, finish } = stubAnimate()
    const handlers = renderSession(card, { options: { trackProgress: false, front: 'term', cardSize: 'small' } })

    await userEvent.setup().click(screen.getByRole('button', { name: /^Know/ }))

    expect(screen.getByTestId(TESTIDS.flashcardGradeBadge)).toHaveTextContent('Know')
    expect(screen.getByTestId(TESTIDS.flashcardTallyKnow)).toHaveTextContent('5')
    expect(screen.getByTestId(TESTIDS.flashcardTallyLearning)).toHaveTextContent('2')
    expect(animate).toHaveBeenCalledTimes(1)
    const [keyframes] = animate.mock.calls[0] as [Keyframe[]]
    expect(String(keyframes[1]?.['transform'])).toContain('translateX(140px)')
    expect(handlers.onGrade).not.toHaveBeenCalled()

    await settle(finish)

    expect(handlers.onGrade).toHaveBeenCalledWith(expect.objectContaining({ known: true }))
  })

  it('sends a still-learning card off to the left with its own badge and tally', async () => {
    const card = makeCard()
    seedStore(card)
    const { animate, finish } = stubAnimate()
    const handlers = renderSession(card, { options: { trackProgress: false, front: 'term', cardSize: 'small' } })

    await userEvent.setup().click(screen.getByRole('button', { name: /^Still learning/ }))

    expect(screen.getByTestId(TESTIDS.flashcardGradeBadge)).toHaveTextContent('Still learning')
    expect(screen.getByTestId(TESTIDS.flashcardTallyLearning)).toHaveTextContent('3')
    const [keyframes] = animate.mock.calls[0] as [Keyframe[]]
    expect(String(keyframes[1]?.['transform'])).toContain('translateX(-140px)')

    await settle(finish)
    expect(handlers.onGrade).toHaveBeenCalledWith(expect.objectContaining({ known: false }))
  })

  it('ignores a second grade while the card is still leaving', async () => {
    const card = makeCard()
    seedStore(card)
    const { animate, finish } = stubAnimate()
    const handlers = renderSession(card, { options: { trackProgress: false, front: 'term', cardSize: 'small' } })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /^Know/ }))
    await user.click(screen.getByRole('button', { name: /^Still learning/ }))
    await settle(finish)

    expect(animate).toHaveBeenCalledTimes(1)
    expect(handlers.onGrade).toHaveBeenCalledTimes(1)
    expect(handlers.onGrade).toHaveBeenCalledWith(expect.objectContaining({ known: true }))
  })

  it('skips the animation and grades immediately under reduced motion', async () => {
    const card = makeCard()
    seedStore(card)
    document.documentElement.dataset['reducedMotion'] = 'true'
    const { animate } = stubAnimate()
    const handlers = renderSession(card, { options: { trackProgress: false, front: 'term', cardSize: 'small' } })

    await userEvent.setup().click(screen.getByRole('button', { name: /^Know/ }))

    expect(animate).not.toHaveBeenCalled()
    expect(screen.queryByTestId(TESTIDS.flashcardGradeBadge)).toBeNull()
    expect(handlers.onGrade).toHaveBeenCalledTimes(1)
  })

  it('never commits a grade if the session unmounts mid-animation (undo or restart)', async () => {
    const card = makeCard()
    seedStore(card)
    const { finish } = stubAnimate()
    const handlers = makeHandlers()
    const view = render(
      sessionElement(card, handlers, { options: { trackProgress: false, front: 'term', cardSize: 'small' } }),
    )

    await userEvent.setup().click(screen.getByRole('button', { name: /^Know/ }))
    view.unmount()
    await settle(finish)

    expect(handlers.onGrade).not.toHaveBeenCalled()
  })
})

describe('FlashcardSession grade animation robustness', () => {
  const stubAnimateNeverFinishing = () => {
    const animate = vi.fn((..._args: unknown[]) => ({ finished: new Promise<void>(() => undefined) }))
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate })
    return animate
  }

  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    Reflect.deleteProperty(HTMLElement.prototype, 'animate')
    Reflect.deleteProperty(document, 'hidden')
  })

  it('grades immediately, without animating, when the page is hidden (a background tab produces no frames)', async () => {
    const card = makeCard()
    seedStore(card)
    const animate = stubAnimateNeverFinishing()
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    const handlers = renderSession(card, { options: { trackProgress: false, front: 'term', cardSize: 'small' } })

    fireEvent.click(screen.getByRole('button', { name: /^Know/ }))

    expect(animate).not.toHaveBeenCalled()
    expect(handlers.onGrade).toHaveBeenCalledTimes(1)
  })

  it('still commits the grade shortly after the nominal end if the animation never reports finished', () => {
    vi.useFakeTimers()
    const card = makeCard()
    seedStore(card)
    const animate = stubAnimateNeverFinishing()
    const handlers = renderSession(card, { options: { trackProgress: false, front: 'term', cardSize: 'small' } })

    fireEvent.click(screen.getByRole('button', { name: /^Know/ }))
    expect(animate).toHaveBeenCalledTimes(1)
    expect(handlers.onGrade).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(handlers.onGrade).toHaveBeenCalledTimes(1)
  })
})
