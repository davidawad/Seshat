import { useCallback, useEffect, useRef, useState } from 'react'
import { useSeshatStore } from '../../lib/store'
import type { StudyCard } from '../../types'
import { cardFrontBack } from '../study/card-summary'
import './flashcards.css'

const UNKNOWN_KEY = '1'
const KNOWN_KEY = '2'

interface FlashcardSessionProps {
  readonly card: StudyCard
  readonly position: number
  readonly total: number
  /** Called after the outcome for the current card has been recorded. */
  readonly onAdvance: (known: boolean) => void
}

/**
 * One card, one screen: classic flip flashcard. No confidence step, no
 * FSRS self-rating scale — just "did you know it," which is deliberately
 * simpler than the default recall-first mode but still worth feeding into
 * FSRS (Know -> good/correct, Don't know -> again/incorrect) rather than
 * discarding the study effort.
 */
export const FlashcardSession = ({ card, position, total, onAdvance }: FlashcardSessionProps) => {
  const { recordReview } = useSeshatStore()
  const [flipped, setFlipped] = useState(false)
  const shownAt = useRef(performance.now())

  // Reset per-card state whenever a new card is shown.
  useEffect(() => {
    setFlipped(false)
    shownAt.current = performance.now()
  }, [card.id])

  const { front, back, imageDataUrl } = cardFrontBack(card)

  const flip = useCallback(() => setFlipped(true), [])

  const handleGrade = useCallback(
    (known: boolean) => {
      const elapsedMs = performance.now() - shownAt.current
      recordReview(card.id, known ? 'good' : 'again', null, known, elapsedMs)
      onAdvance(known)
    },
    [card.id, onAdvance, recordReview],
  )

  // Space/Enter flips the card; once flipped, 1/2 grade it. Skipped while a
  // text input is focused, matching the default study mode's convention.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (!flipped) {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault()
          flip()
        }
        return
      }
      if (event.key === UNKNOWN_KEY) handleGrade(false)
      else if (event.key === KNOWN_KEY) handleGrade(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [flipped, flip, handleGrade])

  return (
    <div className="flashcard-session">
      <p className="review-progress">
        Card {position + 1} of {total}
      </p>

      <div className="illuminated-panel card-content measure flashcard-face" aria-live="polite">
        {imageDataUrl !== undefined && <img src={imageDataUrl} alt="" className="flashcard-image" />}
        <p>{flipped ? back : front}</p>
      </div>

      {!flipped ? (
        <button type="button" onClick={flip} autoFocus>
          Flip card <span className="flashcard-key">(Space)</span>
        </button>
      ) : (
        <div className="flashcard-grade-options">
          <button type="button" onClick={() => handleGrade(false)}>
            Don&rsquo;t know <span className="flashcard-key">({UNKNOWN_KEY})</span>
          </button>
          <button type="button" onClick={() => handleGrade(true)} autoFocus>
            Know <span className="flashcard-key">({KNOWN_KEY})</span>
          </button>
        </div>
      )}
    </div>
  )
}
