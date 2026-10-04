import { CheckIcon, CrossIcon, GearIcon, ShuffleIcon, UndoIcon } from '../../components/icons'
import { formatKeyLabel } from '../../lib/keybindings'
import { TESTIDS } from '../../lib/testids'
import type { Leaving } from './grade-motion'

interface FlashcardControlsProps {
  readonly position: number
  readonly total: number
  /** Resolved binding strings (e.g. 'ArrowLeft', 'A') — shown live so a remap is reflected immediately. */
  readonly keys: {
    readonly stillLearning: string
    readonly know: string
    readonly undo: string
    readonly shuffle: string
  }
  readonly canUndo: boolean
  readonly shuffled: boolean
  readonly onStillLearning: () => void
  readonly onKnow: () => void
  readonly onUndo: () => void
  readonly onToggleShuffle: () => void
  readonly onOpenOptions: () => void
}

/**
 * Outlined count chips above the card: "Still learning n" on the left, "Know n"
 * on the right. While a grade animation runs the chip it is going to is shown
 * already incremented and pulses, so the count visibly lands with the card.
 */
export const FlashcardTally = ({
  knownCount,
  unknownCount,
  leaving,
}: {
  readonly knownCount: number
  readonly unknownCount: number
  readonly leaving: Leaving | null
}) => (
  <div className="flashcard-tally" data-testid={TESTIDS.flashcardTally}>
    <p
      className={
        leaving === 'learning' ? 'flashcard-tally-side is-learning is-bump' : 'flashcard-tally-side is-learning'
      }
    >
      <span>Still learning</span>
      <span className="flashcard-tally-chip" data-testid={TESTIDS.flashcardTallyLearning}>
        {unknownCount + (leaving === 'learning' ? 1 : 0)}
      </span>
    </p>
    <p className={leaving === 'know' ? 'flashcard-tally-side is-know is-bump' : 'flashcard-tally-side is-know'}>
      <span>Know</span>
      <span className="flashcard-tally-chip" data-testid={TESTIDS.flashcardTallyKnow}>
        {knownCount + (leaving === 'know' ? 1 : 0)}
      </span>
    </p>
  </div>
)

/** The strip attached under the card: the Quizlet-style "press [←] / [→]" hint. */
export const FlashcardHint = ({ leftKey, rightKey }: { readonly leftKey: string; readonly rightKey: string }) => (
  <p className="flashcard-hint">
    <span className="flashcard-hint-label">Shortcut</span>
    <span>
      Press <kbd>{formatKeyLabel(leftKey)}</kbd> to study again or <kbd>{formatKeyLabel(rightKey)}</kbd> if you know the
      answer
    </span>
  </p>
)

/**
 * Control bar under the card: still-learning / progress / know in the middle,
 * undo, shuffle and options to the right. Presentational only — the session
 * and runner own what each button actually does.
 */
export const FlashcardControls = ({
  position,
  total,
  keys,
  canUndo,
  shuffled,
  onStillLearning,
  onKnow,
  onUndo,
  onToggleShuffle,
  onOpenOptions,
}: FlashcardControlsProps) => (
  <div className="flashcard-controls">
    <div className="flashcard-grade-cluster">
      <button
        type="button"
        className="flashcard-pill flashcard-pill-learning"
        aria-label={`Still learning (${formatKeyLabel(keys.stillLearning)})`}
        data-testid={TESTIDS.flashcardStillLearning}
        onClick={onStillLearning}
      >
        <CrossIcon />
      </button>
      <p className="flashcard-progress" data-testid={TESTIDS.flashcardProgress}>
        <span className="sr-only">Card </span>
        {position + 1} / {total}
      </p>
      <button
        type="button"
        className="flashcard-pill flashcard-pill-know"
        aria-label={`Know (${formatKeyLabel(keys.know)})`}
        data-testid={TESTIDS.flashcardKnow}
        onClick={onKnow}
      >
        <CheckIcon />
      </button>
    </div>

    <div className="flashcard-tools">
      <button
        type="button"
        className="icon-button"
        aria-label={`Undo (${formatKeyLabel(keys.undo)})`}
        data-testid={TESTIDS.flashcardUndo}
        disabled={!canUndo}
        onClick={onUndo}
      >
        <UndoIcon />
      </button>
      <button
        type="button"
        className="icon-button flashcard-toggle"
        aria-label={`Shuffle (${formatKeyLabel(keys.shuffle)})`}
        aria-pressed={shuffled}
        data-testid={TESTIDS.flashcardShuffle}
        onClick={onToggleShuffle}
      >
        <ShuffleIcon />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label="Options"
        aria-haspopup="dialog"
        data-testid={TESTIDS.flashcardOptions}
        onClick={onOpenOptions}
      >
        <GearIcon />
      </button>
    </div>
  </div>
)
