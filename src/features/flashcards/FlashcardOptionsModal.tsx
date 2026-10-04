import { Modal } from '../../components/Modal'
import { TESTIDS } from '../../lib/testids'
import { type FlashcardsFront, flashcardsFrontSchema } from '../../types'
import { FRONT_LABELS, type FlashcardOptions } from './options'
import './flashcard-options.css'

interface FlashcardOptionsModalProps {
  readonly open: boolean
  readonly options: FlashcardOptions
  readonly onClose: () => void
  readonly onTrackProgressChange: (trackProgress: boolean) => void
  readonly onFrontChange: (front: FlashcardsFront) => void
  readonly onRestart: () => void
}

const TRACK_HINT =
  "Sort your flashcards to keep track of what you know and what you're still learning. Turn progress tracking off if you want to quickly review your flashcards."

/**
 * Quizlet-style Options: bold-labelled rows split by hairline dividers, a
 * switch for progress tracking, a Front select, and a red Restart action.
 * Keyboard shortcuts deliberately live elsewhere (the footer's shortcuts
 * modal), not here.
 */
export const FlashcardOptionsModal = ({
  open,
  options,
  onClose,
  onTrackProgressChange,
  onFrontChange,
  onRestart,
}: FlashcardOptionsModalProps) => (
  <Modal
    open={open}
    onClose={onClose}
    titleId="flashcard-options-title"
    title="Options"
    testId={TESTIDS.flashcardOptionsModal}
    closeTestId={TESTIDS.flashcardOptionsModalClose}
  >
    <div className="flashcard-options">
      <div className="flashcard-options-row">
        <div className="flashcard-options-text">
          <span id="flashcard-track-label" className="flashcard-options-label">
            Track progress
          </span>
          <span id="flashcard-track-hint" className="flashcard-options-hint">
            {TRACK_HINT}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          className="flashcard-switch"
          aria-checked={options.trackProgress}
          aria-labelledby="flashcard-track-label"
          aria-describedby="flashcard-track-hint"
          data-testid={TESTIDS.flashcardTrackProgress}
          onClick={() => onTrackProgressChange(!options.trackProgress)}
        />
      </div>

      <div className="flashcard-options-row">
        <label htmlFor="flashcard-front-select" className="flashcard-options-label">
          Front
        </label>
        <select
          id="flashcard-front-select"
          className="flashcard-options-select"
          value={options.front}
          data-testid={TESTIDS.flashcardFront}
          onChange={(event) => {
            const parsed = flashcardsFrontSchema.safeParse(event.target.value)
            if (parsed.success) onFrontChange(parsed.data)
          }}
        >
          {flashcardsFrontSchema.options.map((side) => (
            <option key={side} value={side}>
              {FRONT_LABELS[side]}
            </option>
          ))}
        </select>
      </div>

      <div className="flashcard-options-row">
        <button type="button" className="flashcard-restart" data-testid={TESTIDS.flashcardRestart} onClick={onRestart}>
          Restart flashcards
        </button>
      </div>
    </div>
  </Modal>
)
