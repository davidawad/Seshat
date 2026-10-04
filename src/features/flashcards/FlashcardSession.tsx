import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { matchesBinding } from '../../lib/keybindings'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import { useKeybindings } from '../../lib/useKeybindings'
import type { StudyCard } from '../../types'
import { cardFrontBack } from '../study/card-summary'
import { FlipCard } from '../../components/FlipCard'
import { FlashcardControls, FlashcardHint } from './FlashcardControls'
import { type FlashcardOptions, gradeForKey, orientFaces } from './options'
import type { GradeRecord } from './session'
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
  readonly options: FlashcardOptions
  /** False while a modal is open over the session, so its keys don't grade or flip the card behind it. */
  readonly shortcutsEnabled: boolean
  /** Called after the outcome for the current card has been recorded (or skipped, if progress tracking is off). */
  readonly onGrade: (record: GradeRecord) => void
  readonly canUndo: boolean
  readonly shuffled: boolean
  readonly onUndo: () => void
  readonly onToggleShuffle: () => void
  readonly onOpenOptions: () => void
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
  <div
    className="flashcard-face"
    role="button"
    tabIndex={0}
    aria-live="polite"
    aria-pressed={flipped}
    // The name must carry the card text: a button's children are presentational,
    // so without it the accessibility tree would hide the question and answer.
    aria-label={
      flipped
        ? `Answer revealed: ${back} (activate to show the question)`
        : `Question shown: ${front} (activate to reveal the answer)`
    }
    data-testid={TESTIDS.flashcardFace}
    onClick={onClick}
    onKeyDown={onKeyDown}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerCancel}
    style={dragX !== 0 ? { transform: `translateX(${dragX}px)` } : undefined}
  >
    <FlipCard front={front} back={back} imageDataUrl={imageDataUrl} flipped={flipped} />
  </div>
)

/**
 * One card, one screen: classic flip flashcard. No confidence step, no
 * FSRS self-rating scale — just "did you know it," which is deliberately
 * simpler than the default recall-first mode but still worth feeding into
 * FSRS (Know -> good/correct, Don't know -> again/incorrect) rather than
 * discarding the study effort — unless the learner turned progress tracking
 * off in Options, in which case grading only moves to the next card. As in
 * Quizlet, a card can be graded without flipping it first.
 */
export const FlashcardSession = ({
  card,
  position,
  total,
  options,
  shortcutsEnabled,
  onGrade,
  canUndo,
  shuffled,
  onUndo,
  onToggleShuffle,
  onOpenOptions,
}: FlashcardSessionProps) => {
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

  const { imageDataUrl, ...faces } = cardFrontBack(card)
  const { front, back } = orientFaces(faces, options.front)

  const toggleFlip = useCallback(() => setFlipped((current) => !current), [])

  const handleGrade = useCallback(
    (known: boolean) => {
      const elapsedMs = performance.now() - shownAt.current
      const reviewedAt = options.trackProgress
        ? recordReview(card.id, known ? 'good' : 'again', null, known, elapsedMs)
        : null
      onGrade({
        cardId: card.id,
        known,
        previousScheduling: reviewedAt === null ? null : card.scheduling,
        reviewedAt,
      })
    },
    [card.id, card.scheduling, onGrade, options.trackProgress, recordReview],
  )

  // Remappable shortcuts: Space flips; the nav left/right keys (arrows by
  // default, WASD/HJKL by preset) and 1/2 grade. Skipped while a text input
  // is focused, matching the default study mode's convention — and for the
  // flip key while a button/select has focus, since Space already activates
  // those and would otherwise do both.
  useEffect(() => {
    if (!shortcutsEnabled) return
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (matchesBinding(keyFor('flashcards.flip'), event)) {
        if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLSelectElement) return
        event.preventDefault()
        toggleFlip()
        return
      }
      const grade = gradeForKey(event, keyFor)
      if (grade === null) return
      event.preventDefault()
      handleGrade(grade === 'know')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcutsEnabled, toggleFlip, handleGrade, keyFor])

  const handleFaceClick = () => {
    // A swipe that just released fires a synthetic click right after —
    // swallow exactly that one so a completed swipe doesn't also flip/grade
    // a second time via the click path.
    if (justSwiped.current) {
      justSwiped.current = false
      return
    }
    toggleFlip()
  }

  // Space is handled by the window listener above (it is the remappable flip
  // key); Enter is the extra activation a focused role="button" face owes.
  const handleFaceKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    toggleFlip()
  }

  // Swipe navigation, additive to tap/Space/grade buttons/keys above.
  // Follows the pointer-capture + threshold-on-release pattern used by the
  // occlusion-region drag in ImageOcclusionEditor.tsx. A swipe commits a
  // grade and advances — left mirrors "still learning", right mirrors
  // "know" — same as the buttons/keys, just gestural.
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
    handleGrade(deltaX > 0)
  }

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    swipeStartX.current = null
    swipeStartY.current = null
    endSwipeGesture(event)
  }

  return (
    <div className="flashcard-session">
      <div className="flashcard-stack">
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
        <FlashcardHint leftKey={keyFor('nav.left')} rightKey={keyFor('nav.right')} />
      </div>

      <FlashcardControls
        position={position}
        total={total}
        keys={{
          stillLearning: keyFor('nav.left'),
          know: keyFor('nav.right'),
          undo: keyFor('flashcards.undo'),
          shuffle: keyFor('flashcards.toggleOrder'),
        }}
        canUndo={canUndo}
        shuffled={shuffled}
        onStillLearning={() => handleGrade(false)}
        onKnow={() => handleGrade(true)}
        onUndo={onUndo}
        onToggleShuffle={onToggleShuffle}
        onOpenOptions={onOpenOptions}
      />
    </div>
  )
}
