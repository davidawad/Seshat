import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
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
import { FlashcardControls, FlashcardHint, FlashcardTally } from './FlashcardControls'
import { type FlashcardOptions, gradeForKey, orientFaces } from './options'
import type { GradeRecord } from './session'
import { useCardSwipe } from './useCardSwipe'
import { useGradeMotion } from './useGradeMotion'
import './flashcards.css'

interface FlashcardSessionProps {
  readonly card: StudyCard
  readonly position: number
  readonly total: number
  readonly options: FlashcardOptions
  /** False while a modal is open over the session, so its keys don't grade or flip the card behind it. */
  readonly shortcutsEnabled: boolean
  /** Called after the outcome for the current card has been recorded (or skipped, if progress tracking is off). */
  readonly onGrade: (record: GradeRecord) => void
  /** Running totals for the tally chips above the card (the current card is not counted yet). */
  readonly knownCount: number
  readonly unknownCount: number
  readonly canUndo: boolean
  readonly shuffled: boolean
  readonly onUndo: () => void
  readonly onToggleShuffle: () => void
  readonly onOpenOptions: () => void
}

interface FlashcardFaceProps {
  readonly ref: Ref<HTMLDivElement>
  /** Shown on top of the card, travelling with it (the Know / Still learning badge). */
  readonly badge: ReactNode
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
  ref,
  badge,
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
    ref={ref}
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
    {badge}
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
  knownCount,
  unknownCount,
  canUndo,
  shuffled,
  onUndo,
  onToggleShuffle,
  onOpenOptions,
}: FlashcardSessionProps) => {
  const { recordReview } = useSeshatStore()
  const { key: keyFor } = useKeybindings()
  const [flipped, setFlipped] = useState(false)
  const faceRef = useRef<HTMLDivElement>(null)
  const shownAt = useRef(performance.now())

  // Reset per-card state whenever a new card is shown.
  useEffect(() => {
    setFlipped(false)
    shownAt.current = performance.now()
  }, [card.id])

  const { imageDataUrl, ...faces } = cardFrontBack(card)
  const { front, back } = orientFaces(faces, options.front)

  const toggleFlip = useCallback(() => setFlipped((current) => !current), [])

  const commitGrade = useCallback(
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

  const { leaving, handleGrade } = useGradeMotion(faceRef, commitGrade)
  const { dragX, consumeSwipeClick, pointerHandlers } = useCardSwipe(handleGrade, card.id)

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
    if (consumeSwipeClick()) return
    toggleFlip()
  }

  // Space is handled by the window listener above (it is the remappable flip
  // key); Enter is the extra activation a focused role="button" face owes.
  const handleFaceKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    toggleFlip()
  }

  return (
    <div className="flashcard-session">
      <FlashcardTally knownCount={knownCount} unknownCount={unknownCount} leaving={leaving} />
      <div className={leaving === null ? 'flashcard-stack' : `flashcard-stack is-leaving-${leaving}`}>
        <FlashcardFace
          ref={faceRef}
          badge={
            leaving === null ? null : (
              <span
                className={`flashcard-grade-badge is-${leaving}`}
                aria-hidden="true"
                data-testid={TESTIDS.flashcardGradeBadge}
              >
                {leaving === 'know' ? 'Know' : 'Still learning'}
              </span>
            )
          }
          flipped={flipped}
          front={front}
          back={back}
          imageDataUrl={imageDataUrl}
          dragX={dragX}
          onClick={handleFaceClick}
          onKeyDown={handleFaceKeyDown}
          {...pointerHandlers}
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
