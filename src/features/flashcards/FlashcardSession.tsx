import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ShortcutHelp, type Shortcut } from '../../components/ShortcutHelp'
import { matchesBinding } from '../../lib/keybindings'
import { useSeshatStore } from '../../lib/store'
import { useKeybindings } from '../../lib/useKeybindings'
import type { StudyCard } from '../../types'
import { cardFrontBack } from '../study/card-summary'
import './flashcards.css'

/** Minimum horizontal drag, in px, before a pointer gesture counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD_PX = 60
/** Caps how far the card visually follows the finger, so a long drag doesn't fling it off-panel. */
const DRAG_VISUAL_CAP_PX = 80

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

interface FlashcardSessionProps {
  readonly card: StudyCard
  readonly position: number
  readonly total: number
  /** Called after the outcome for the current card has been recorded. */
  readonly onAdvance: (known: boolean) => void
}

interface FlashcardFaceProps {
  readonly flipped: boolean
  readonly front: string
  readonly back: string
  readonly imageDataUrl: string | undefined
  readonly dragX: number
  readonly onClick: () => void
  readonly onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  readonly onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void
}

/** The flippable card face itself — split out of `FlashcardSession` to keep that component's size in check. */
const FlashcardFace = ({
  flipped,
  front,
  back,
  imageDataUrl,
  dragX,
  onClick,
  onKeyDown,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: FlashcardFaceProps) => (
  <div className="flashcard-flip-scene">
    <div
      className="legible legible-measure illuminated-panel flashcard-face"
      role="button"
      tabIndex={0}
      aria-live="polite"
      aria-pressed={flipped}
      aria-label={flipped ? 'Answer revealed' : 'Question shown. Activate to reveal the answer.'}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={dragX !== 0 ? { transform: `translateX(${dragX}px)` } : undefined}
    >
      <div className={flipped ? 'flashcard-flip-inner is-flipped' : 'flashcard-flip-inner'}>
        <div className="flashcard-flip-face flashcard-flip-front">
          {imageDataUrl !== undefined && <img src={imageDataUrl} alt="" className="flashcard-image" />}
          <p>{front}</p>
        </div>
        <div className="flashcard-flip-face flashcard-flip-back">
          {imageDataUrl !== undefined && <img src={imageDataUrl} alt="" className="flashcard-image" />}
          <p>{back}</p>
        </div>
      </div>
    </div>
  </div>
)

/**
 * One card, one screen: classic flip flashcard. No confidence step, no
 * FSRS self-rating scale — just "did you know it," which is deliberately
 * simpler than the default recall-first mode but still worth feeding into
 * FSRS (Know -> good/correct, Don't know -> again/incorrect) rather than
 * discarding the study effort.
 */
export const FlashcardSession = ({ card, position, total, onAdvance }: FlashcardSessionProps) => {
  const { recordReview } = useSeshatStore()
  const { key: keyFor } = useKeybindings()
  const [flipped, setFlipped] = useState(false)
  const [dragX, setDragX] = useState(0)
  const shownAt = useRef(performance.now())
  // Pointer-swipe tracking: the client X the current gesture started at (null
  // when no gesture is in progress), plus a flag so the synthetic click that
  // follows a released drag doesn't also flip/re-trigger the card.
  const swipeStartX = useRef<number | null>(null)
  const swipeStartY = useRef<number | null>(null)
  const justSwiped = useRef(false)

  // Reset per-card state whenever a new card is shown.
  useEffect(() => {
    setFlipped(false)
    setDragX(0)
    swipeStartX.current = null
    swipeStartY.current = null
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

  // Remappable flip/grade shortcuts (defaults: Space to flip, 1/2 to grade
  // once flipped) — skipped while a text input is focused, matching the
  // default study mode's convention.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (!flipped) {
        if (matchesBinding(keyFor('flashcards.flip'), event)) {
          event.preventDefault()
          flip()
        }
        return
      }
      if (matchesBinding(keyFor('flashcards.dontKnow'), event)) handleGrade(false)
      else if (matchesBinding(keyFor('flashcards.know'), event)) handleGrade(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [flipped, flip, handleGrade, keyFor])

  const handleFaceClick = () => {
    // A swipe that just released fires a synthetic click right after —
    // swallow exactly that one so a completed swipe doesn't also flip/grade
    // a second time via the click path.
    if (justSwiped.current) {
      justSwiped.current = false
      return
    }
    if (!flipped) flip()
  }

  const handleFaceKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    if (!flipped) flip()
  }

  // Swipe navigation, additive to tap/Space/grade buttons/1-2 keys above.
  // Follows the pointer-capture + threshold-on-release pattern used by the
  // occlusion-region drag in ImageOcclusionEditor.tsx. Before the card is
  // flipped, either direction just reveals the answer (there's nothing else
  // to navigate to pre-reveal). Once flipped, a swipe commits a grade and
  // advances — left mirrors the "Don't know" (1) action, right mirrors
  // "Know" (2) — same as the existing grade buttons/keys, just gestural.
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    swipeStartX.current = event.clientX
    swipeStartY.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (swipeStartX.current === null) return
    setDragX(clamp(event.clientX - swipeStartX.current, -DRAG_VISUAL_CAP_PX, DRAG_VISUAL_CAP_PX))
  }

  const endSwipeGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDragX(0)
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const startX = swipeStartX.current
    const startY = swipeStartY.current
    swipeStartX.current = null
    swipeStartY.current = null
    endSwipeGesture(event)
    if (startX === null || startY === null) return

    const deltaX = event.clientX - startX
    const deltaY = event.clientY - startY
    // Ignore small movements (a tap) and mostly-vertical drags (scrolling).
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY)) return

    justSwiped.current = true
    if (!flipped) {
      flip()
      return
    }
    handleGrade(deltaX > 0)
  }

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    swipeStartX.current = null
    swipeStartY.current = null
    endSwipeGesture(event)
  }

  const flashcardShortcuts = useMemo<readonly Shortcut[]>(
    () => [
      { key: keyFor('flashcards.flip'), label: 'Flip card' },
      { key: keyFor('flashcards.dontKnow'), label: "Don't know (once flipped)" },
      { key: keyFor('flashcards.know'), label: 'Know (once flipped)' },
    ],
    [keyFor],
  )

  return (
    <div className="flashcard-session">
      <p className="review-progress">
        Card {position + 1} of {total}
      </p>

      <ShortcutHelp shortcuts={flashcardShortcuts} />

      <FlashcardFace
        flipped={flipped}
        front={front}
        back={back}
        imageDataUrl={imageDataUrl}
        dragX={dragX}
        onClick={handleFaceClick}
        onKeyDown={handleFaceKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />

      {!flipped ? (
        <button type="button" onClick={flip} autoFocus>
          Flip card <span className="flashcard-key">({keyFor('flashcards.flip')})</span>
        </button>
      ) : (
        <div className="flashcard-grade-options">
          <button type="button" onClick={() => handleGrade(false)}>
            Don&rsquo;t know <span className="flashcard-key">({keyFor('flashcards.dontKnow')})</span>
          </button>
          <button type="button" onClick={() => handleGrade(true)} autoFocus>
            Know <span className="flashcard-key">({keyFor('flashcards.know')})</span>
          </button>
        </div>
      )}
    </div>
  )
}
