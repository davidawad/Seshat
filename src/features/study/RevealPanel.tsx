import { Legible } from '../../components/Legible'
import type { Grade, StudyCard } from '../../types'
import { type Attempt, GRADE_ORDER, attemptLabel, correctAnswerLabel } from './grading'
import { ImageOcclusionReveal } from './ImageOcclusionReveal'

const GRADE_LABELS: Record<Grade, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' }

const GRADE_OPTIONS: readonly { readonly value: Grade; readonly label: string; readonly key: string }[] =
  GRADE_ORDER.map((value, index) => ({ value, label: GRADE_LABELS[value], key: String(index + 1) }))

interface RevealPanelProps {
  readonly card: StudyCard
  readonly attempt: Attempt
  readonly correct: boolean
  readonly onGrade: (grade: Grade) => void
}

/**
 * Reveal + FSRS self-rating step. Correctness was already auto-graded from
 * the attempt, but per standard Anki/FSRS UX, the learner's own Again/Hard/
 * Good/Easy rating is what actually drives spacing — so it's always offered,
 * just biased toward "Again" when the auto-grade came back wrong.
 */
export const RevealPanel = ({ card, attempt, correct, onGrade }: RevealPanelProps) => {
  const yourAnswer = attemptLabel(card.content, attempt)
  const correctAnswer = correctAnswerLabel(card.content, attempt)
  const suggestedGrade: Grade = correct ? 'good' : 'again'

  return (
    <div className="review-reveal">
      <p
        role="status"
        aria-live="polite"
        className={correct ? 'review-result is-correct' : 'review-result is-incorrect'}
      >
        {correct ? 'Correct' : 'Incorrect'}
      </p>
      <Legible>
        {card.content.kind === 'image-occlusion' && attempt.kind === 'image-occlusion' && (
          <ImageOcclusionReveal prompt={card.prompt} content={card.content} targetRegionId={attempt.targetRegionId} />
        )}
        {!correct && yourAnswer !== '' && <p className="review-your-answer">Your answer: {yourAnswer}</p>}
        <p className="review-correct-answer">Correct answer: {correctAnswer}</p>
        {card.explanation !== null && <p className="review-explanation">{card.explanation}</p>}
        {card.sourceRef !== null && <p className="review-source">Source: {card.sourceRef}</p>}
      </Legible>
      <fieldset className="review-grade">
        <legend>How well did you recall this?</legend>
        <div className="grade-options">
          {GRADE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              autoFocus={option.value === suggestedGrade}
              className={option.value === suggestedGrade ? 'grade-button is-suggested' : 'grade-button'}
              onClick={() => onGrade(option.value)}
            >
              {option.label} <span className="grade-key">({option.key})</span>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
