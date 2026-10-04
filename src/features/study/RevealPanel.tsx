import { useCallback, useId, useRef, useState } from 'react'
import { Legible } from '../../components/Legible'
import { TESTIDS } from '../../lib/testids'
import { useKeybindings } from '../../lib/useKeybindings'
import { NAV_OPTION_ATTRIBUTE, useOptionNavigation } from '../../lib/useOptionNavigation'
import type { Grade, StudyCard } from '../../types'
import { type Attempt, GRADE_ORDER, attemptLabel, correctAnswerLabel } from './grading'
import { ImageOcclusionReveal } from './ImageOcclusionReveal'

const GRADE_LABELS: Record<Grade, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' }

/** action id in lib/keybindings.ts for each grade, in `GRADE_ORDER`. */
const GRADE_ACTION_IDS: readonly string[] = [
  'studyReveal.again',
  'studyReveal.hard',
  'studyReveal.good',
  'studyReveal.easy',
]

const GRADE_TESTIDS: Readonly<Record<Grade, string>> = {
  again: TESTIDS.studyGradeAgain,
  hard: TESTIDS.studyGradeHard,
  good: TESTIDS.studyGradeGood,
  easy: TESTIDS.studyGradeEasy,
}

const GRADE_VALUES: readonly { readonly value: Grade; readonly label: string; readonly actionId: string }[] =
  GRADE_ORDER.map((value, index) => ({ value, label: GRADE_LABELS[value], actionId: GRADE_ACTION_IDS[index]! }))

interface RevealPanelProps {
  readonly card: StudyCard
  readonly attempt: Attempt
  readonly correct: boolean
  readonly onGrade: (grade: Grade) => void
  /** `null` when Settings.selfExplanationEnabled is off — hides the prompt entirely. */
  readonly selfExplanation: string | null
  readonly onSelfExplanationChange: (value: string) => void
}

/**
 * Reveal + FSRS self-rating step. Correctness was already auto-graded from
 * the attempt, but per standard Anki/FSRS UX, the learner's own Again/Hard/
 * Good/Easy rating is what actually drives spacing — so it's always offered,
 * just biased toward "Again" when the auto-grade came back wrong.
 */
export const RevealPanel = ({
  card,
  attempt,
  correct,
  onGrade,
  selfExplanation,
  onSelfExplanationChange,
}: RevealPanelProps) => {
  const yourAnswer = attemptLabel(card.content, attempt)
  const correctAnswer = correctAnswerLabel(card.content, attempt)
  const suggestedGrade: Grade = correct ? 'good' : 'again'
  const selfExplanationId = useId()
  const { key: keyFor } = useKeybindings()

  // Arrow-style navigation across the grade buttons, starting on the suggested one (which is autoFocused).
  const [gradeIndex, setGradeIndex] = useState(() =>
    GRADE_VALUES.findIndex((option) => option.value === suggestedGrade),
  )
  const gradeRef = useRef<HTMLDivElement>(null)
  const confirmGrade = useCallback(
    (index: number) => {
      const option = GRADE_VALUES[index]
      if (option !== undefined) onGrade(option.value)
    },
    [onGrade],
  )
  useOptionNavigation({
    count: GRADE_VALUES.length,
    index: gradeIndex,
    onIndexChange: setGradeIndex,
    onConfirm: confirmGrade,
    orientation: 'horizontal',
    enabled: true,
    containerRef: gradeRef,
  })

  return (
    <div className={correct ? 'review-reveal is-correct' : 'review-reveal is-incorrect'}>
      <p
        role="status"
        className={correct ? 'review-result is-correct' : 'review-result is-incorrect'}
        data-testid={TESTIDS.studyResult}
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
        {selfExplanation !== null && (
          <div className="review-self-explanation">
            <label htmlFor={selfExplanationId}>Why is that the correct answer? (optional)</label>
            <textarea
              id={selfExplanationId}
              data-testid={TESTIDS.studySelfExplanation}
              value={selfExplanation}
              onChange={(event) => onSelfExplanationChange(event.target.value)}
              rows={2}
            />
          </div>
        )}
      </Legible>
      <fieldset className="review-grade">
        <legend>How well did you recall this?</legend>
        <div ref={gradeRef} className="grade-options">
          {GRADE_VALUES.map((option) => (
            <button
              key={option.value}
              type="button"
              autoFocus={option.value === suggestedGrade}
              data-testid={GRADE_TESTIDS[option.value]}
              className={option.value === suggestedGrade ? 'grade-button is-suggested' : 'grade-button'}
              onClick={() => onGrade(option.value)}
              onFocus={() => setGradeIndex(GRADE_VALUES.indexOf(option))}
              {...{ [NAV_OPTION_ATTRIBUTE]: '' }}
            >
              {option.label} <span className="grade-key">({keyFor(option.actionId)})</span>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
