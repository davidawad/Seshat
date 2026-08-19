import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardId, SetId } from '../../types'
import { MatchSession } from './MatchSession'
import type { MatchPair } from './round'

// @testing-library/react's auto-cleanup needs a global `afterEach`, which
// this project doesn't enable (no `test.globals: true` in vite.config.ts) —
// without this, DOM from one test leaks into the next.
afterEach(() => cleanup())

const setId = 'match-set' as SetId

const twoPairs: MatchPair[] = [
  { cardId: 'card-1' as CardId, front: 'Term A', back: 'Def A' },
  { cardId: 'card-2' as CardId, front: 'Term B', back: 'Def B' },
]

// 7 pairs so `availablePairCaps` offers two round-size choices (6 and 7) —
// the tile-count switcher only renders when more than one choice exists.
const sevenPairs: MatchPair[] = Array.from({ length: 7 }, (_, i) => ({
  cardId: `card-${i + 1}` as CardId,
  front: `Term ${i + 1}`,
  back: `Def ${i + 1}`,
}))

/**
 * Plays a full round to completion by matching every tile currently on the
 * board. Looked up dynamically (rather than assumed from a fixed index)
 * because a round smaller than the full pair set is a random subset.
 * Advances the (mocked) clock by `elapseMs` right before the final match so
 * the recorded completion time is > 0ms — a stored best of exactly 0
 * round-trips as "no best" (see bestTime.ts's `parsed > 0` guard), which
 * would make the "best time reappears" assertions flaky.
 */
const playFullRound = async (
  user: ReturnType<typeof userEvent.setup>,
  pairs: readonly MatchPair[],
  advanceTime: (ms: number) => void,
  elapseMs = 2000,
) => {
  const frontToBack = new Map(pairs.map((pair) => [pair.front, pair.back]))
  const frontTexts = new Set(pairs.map((pair) => pair.front))
  const roundFronts = screen
    .getAllByRole('button')
    .map((button) => button.textContent)
    .filter((text): text is string => text !== null && frontTexts.has(text))

  for (let i = 0; i < roundFronts.length; i++) {
    const front = roundFronts[i]!
    await user.click(screen.getByRole('button', { name: front }))
    if (i === roundFronts.length - 1) advanceTime(elapseMs)
    const back = frontToBack.get(front)
    if (back === undefined) throw new Error(`no back found for front "${front}"`)
    await user.click(screen.getByRole('button', { name: back }))
  }
}

describe('MatchSession', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('renders the initial status bar and full tile grid', () => {
    render(<MatchSession setId={setId} pairs={twoPairs} />)

    expect(screen.getByText('Time: 0.0s')).toBeInTheDocument()
    expect(screen.getByText('Mistakes: 0')).toBeInTheDocument()
    expect(screen.getByText('No personal best yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Term A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Term B' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Def A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Def B' })).toBeInTheDocument()
  })

  it('marks two tiles matched when they share a card, and announces it via the feedback status', async () => {
    const user = userEvent.setup()
    render(<MatchSession setId={setId} pairs={twoPairs} />)

    await user.click(screen.getByRole('button', { name: 'Term A' }))
    await user.click(screen.getByRole('button', { name: 'Def A' }))

    expect(screen.getByText('Matched "Term A" with "Def A".')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Term A/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Def A/ })).toBeDisabled()
  })

  it('counts a mismatch as a mistake and blocks further selection until the miss-dwell clears', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MatchSession setId={setId} pairs={twoPairs} />)

    await user.click(screen.getByRole('button', { name: 'Term A' }))
    await user.click(screen.getByRole('button', { name: 'Def B' }))

    expect(screen.getByText('Not a match — try again.')).toBeInTheDocument()
    expect(screen.getByText('Mistakes: 1')).toBeInTheDocument()

    // Board is locked while the miss is still on display.
    await user.click(screen.getByRole('button', { name: 'Term B' }))
    expect(screen.getByRole('button', { name: 'Term B' })).toHaveAttribute('aria-pressed', 'false')

    act(() => {
      vi.advanceTimersByTime(700)
    })

    // Unlocked once the dwell timeout has cleared.
    await user.click(screen.getByRole('button', { name: 'Term B' }))
    expect(screen.getByRole('button', { name: 'Term B' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('completes a round, records a personal best, and offers Play again', async () => {
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const user = userEvent.setup()
    render(<MatchSession setId={setId} pairs={twoPairs} />)

    await playFullRound(user, twoPairs, (ms) => {
      now += ms
    })

    expect(screen.getByText(/Round complete in 2\.0s — new personal best\./)).toBeInTheDocument()
    expect(screen.getByText(/Best: 2\.0s/)).toBeInTheDocument()
    expect(screen.getByText(/\(new\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
  })

  it('scopes the personal best to the current tile count — switching round size does not leak a best from another size', async () => {
    let now = 2_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const user = userEvent.setup()
    render(<MatchSession setId={setId} pairs={sevenPairs} />)

    // Default round size for 7 available pairs is 7 (min(DEFAULT_PAIR_CAP=8, 7)).
    expect(screen.getByRole('button', { name: '7 pairs', pressed: true })).toBeInTheDocument()

    await playFullRound(user, sevenPairs, (ms) => {
      now += ms
    })
    expect(screen.getByText(/Best: 2\.0s/)).toBeInTheDocument()

    // Switch to the 6-pair round: nothing has been completed there yet, so
    // this must NOT show the 7-pair best.
    await user.click(screen.getByRole('button', { name: '6 pairs' }))
    expect(screen.getByText('No personal best yet')).toBeInTheDocument()

    // Switch back to 7 pairs: the earlier best must reappear, not be lost or
    // overwritten by the cap switch.
    await user.click(screen.getByRole('button', { name: '7 pairs' }))
    expect(screen.getByText(/Best: 2\.0s/)).toBeInTheDocument()
  })

  it('Play again restarts a round at the currently selected tile count, not a stale or default one', async () => {
    let now = 3_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const user = userEvent.setup()
    render(<MatchSession setId={setId} pairs={sevenPairs} />)

    // Switch to the non-default 6-pair round before playing at all.
    await user.click(screen.getByRole('button', { name: '6 pairs' }))
    await playFullRound(user, sevenPairs, (ms) => {
      now += ms
    })

    await user.click(screen.getByRole('button', { name: 'Play again' }))

    // The restarted round is still a 6-pair round (12 tiles) — if the
    // "Play again" click handler ever regressed to passing the click event
    // itself as `cap` (a default-parameter footgun), this would instead
    // produce a NaN-sized or empty board.
    const tileButtons = screen
      .getAllByRole('button')
      .filter((button) =>
        sevenPairs.some((pair) => pair.front === button.textContent || pair.back === button.textContent),
      )
    expect(tileButtons).toHaveLength(12)

    expect(screen.getByText('Time: 0.0s')).toBeInTheDocument()
    expect(screen.getByText('Mistakes: 0')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '6 pairs', pressed: true })).toBeInTheDocument()
  })
})
