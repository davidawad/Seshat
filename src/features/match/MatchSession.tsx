import { useEffect, useRef, useState } from 'react'
import { Legible } from '../../components/Legible'
import type { CardId, SetId } from '../../types'
import { formatElapsed, getBestTimeMs, recordCompletionTime } from './bestTime'
import './match.css'
import { type MatchPair, type MatchTile, DEFAULT_PAIR_CAP, availablePairCaps, createRound } from './round'

/** How long a missed pair stays visually marked before it clears, in ms. Not
 *  an animation — just how long the "not a match" state is held before the
 *  board unlocks again. `[data-reduced-motion]` only neutralizes CSS
 *  transition/animation durations, not this; a bit of dwell time on a miss
 *  is the whole point (long enough to register which two tiles were wrong),
 *  not a "distracting animation" the reduced-motion rule is meant to strip. */
const MISS_DWELL_MS = 700

/** How often the live elapsed-time display updates while a round is in progress. */
const TICK_MS = 100

interface MatchSessionProps {
  readonly setId: SetId
  readonly pairs: readonly MatchPair[]
}

interface TileButtonProps {
  readonly tile: MatchTile
  readonly isSelected: boolean
  readonly isMatched: boolean
  readonly isMiss: boolean
  readonly onSelect: (tile: MatchTile) => void
}

const TileButton = ({ tile, isSelected, isMatched, isMiss, onSelect }: TileButtonProps) => {
  const classNames = ['match-tile']
  if (isSelected) classNames.push('is-selected')
  if (isMatched) classNames.push('is-matched')
  if (isMiss) classNames.push('is-miss')

  return (
    <button
      type="button"
      className={classNames.join(' ')}
      aria-pressed={isSelected}
      disabled={isMatched}
      onClick={() => onSelect(tile)}
    >
      <Legible as="span" measure={false} className="match-tile-text">
        {tile.text}
      </Legible>
      {isMatched && <span className="visually-hidden"> (matched)</span>}
    </button>
  )
}

export const MatchSession = ({ setId, pairs }: MatchSessionProps) => {
  const pairCapChoices = availablePairCaps(pairs.length)
  const [pairCap, setPairCap] = useState<number>(Math.min(DEFAULT_PAIR_CAP, pairs.length))
  const [round, setRound] = useState<readonly MatchTile[]>(() => createRound(pairs, pairCap))
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)
  const [matchedCardIds, setMatchedCardIds] = useState<ReadonlySet<CardId>>(new Set())
  const [missTileIds, setMissTileIds] = useState<readonly [string, string] | null>(null)
  const [mistakeCount, setMistakeCount] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [completedAt, setCompletedAt] = useState<number | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())
  const [feedback, setFeedback] = useState<string>('')
  const [bestAtStart, setBestAtStart] = useState<number | null>(() => getBestTimeMs(setId, pairCap))
  const [isNewBest, setIsNewBest] = useState<boolean>(false)

  const missTimeoutRef = useRef<number | null>(null)

  // Tick the live elapsed display while a round is in progress.
  useEffect(() => {
    if (startedAt === null || completedAt !== null) return
    const intervalId = window.setInterval(() => setNow(Date.now()), TICK_MS)
    return () => window.clearInterval(intervalId)
  }, [startedAt, completedAt])

  // Clear any pending miss-dwell timeout on unmount (e.g. navigating away mid-miss-flash).
  useEffect(
    () => () => {
      if (missTimeoutRef.current !== null) window.clearTimeout(missTimeoutRef.current)
    },
    [],
  )

  const pairCount = round.length / 2
  const elapsedMs = startedAt === null ? 0 : (completedAt ?? now) - startedAt

  const startNewRound = (cap: number = pairCap) => {
    if (missTimeoutRef.current !== null) {
      window.clearTimeout(missTimeoutRef.current)
      missTimeoutRef.current = null
    }
    setRound(createRound(pairs, cap))
    setSelectedTileId(null)
    setMatchedCardIds(new Set())
    setMissTileIds(null)
    setMistakeCount(0)
    setStartedAt(null)
    setCompletedAt(null)
    setFeedback('')
    setBestAtStart(getBestTimeMs(setId, cap))
    setIsNewBest(false)
  }

  const handleCapChange = (cap: number) => {
    setPairCap(cap)
    startNewRound(cap)
  }

  const handleSelect = (tile: MatchTile) => {
    if (completedAt !== null || missTileIds !== null || matchedCardIds.has(tile.cardId)) return

    if (startedAt === null) setStartedAt(Date.now())

    if (selectedTileId === null) {
      setSelectedTileId(tile.tileId)
      return
    }

    if (selectedTileId === tile.tileId) {
      setSelectedTileId(null)
      return
    }

    const firstTile = round.find((candidate) => candidate.tileId === selectedTileId)
    if (firstTile === undefined) {
      // Shouldn't happen, but fail safe rather than throw.
      setSelectedTileId(tile.tileId)
      return
    }

    if (firstTile.cardId === tile.cardId) {
      const nextMatched = new Set(matchedCardIds)
      nextMatched.add(tile.cardId)
      setMatchedCardIds(nextMatched)
      setSelectedTileId(null)
      setFeedback(`Matched "${firstTile.text}" with "${tile.text}".`)

      if (nextMatched.size === pairCount) {
        const finishedAt = Date.now()
        const elapsed = finishedAt - (startedAt ?? finishedAt)
        setCompletedAt(finishedAt)
        const previousBest = bestAtStart
        const updatedBest = recordCompletionTime(setId, pairCap, elapsed)
        const wonBest = previousBest === null || elapsed < previousBest
        setIsNewBest(wonBest)
        setBestAtStart(updatedBest)
        setFeedback(
          wonBest
            ? `Round complete in ${formatElapsed(elapsed)} — new personal best.`
            : `Round complete in ${formatElapsed(elapsed)}.`,
        )
      }
      return
    }

    setMissTileIds([selectedTileId, tile.tileId])
    setSelectedTileId(null)
    setMistakeCount((count) => count + 1)
    setFeedback('Not a match — try again.')
    missTimeoutRef.current = window.setTimeout(() => {
      setMissTileIds(null)
      missTimeoutRef.current = null
    }, MISS_DWELL_MS)
  }

  const isComplete = completedAt !== null

  return (
    <div className="match-session">
      <div className="match-status-bar">
        <p className="match-timer">Time: {formatElapsed(elapsedMs)}</p>
        <p className="match-mistakes">Mistakes: {mistakeCount}</p>
        <p className="match-best">
          {bestAtStart === null ? 'No personal best yet' : `Best: ${formatElapsed(bestAtStart)}`}
          {isComplete && isNewBest && ' (new)'}
        </p>
      </div>

      {pairCapChoices.length > 1 && (
        <fieldset className="match-cap-choices">
          <legend className="sr-only">Tiles per round</legend>
          {pairCapChoices.map((cap) => (
            <button
              key={cap}
              type="button"
              aria-pressed={cap === pairCap}
              className={cap === pairCap ? 'is-active' : ''}
              onClick={() => handleCapChange(cap)}
            >
              {cap} pairs
            </button>
          ))}
        </fieldset>
      )}

      <p role="status" aria-live="polite" className="match-feedback">
        {feedback}
      </p>

      <div className="match-grid">
        {round.map((tile) => (
          <TileButton
            key={tile.tileId}
            tile={tile}
            isSelected={tile.tileId === selectedTileId}
            isMatched={matchedCardIds.has(tile.cardId)}
            isMiss={missTileIds !== null && missTileIds.includes(tile.tileId)}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {isComplete && (
        <button type="button" className="match-play-again" onClick={() => startNewRound()} autoFocus>
          Play again
        </button>
      )}
    </div>
  )
}
