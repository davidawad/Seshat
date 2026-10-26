import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import type { ConfidenceRating, Grade, StudyCard } from '../../types'
import { CardInput } from './CardInput'
import { ConfidencePrompt } from './ConfidencePrompt'
import {
  type Attempt,
  type StudyStep,
  derivedGrade,
  initialAttempt,
  isAttemptComplete,
  isCorrect,
  stepAfterAnswer,
} from './grading'
import { RevealPanel } from './RevealPanel'
import { useStudyShortcuts } from './useStudyShortcuts'
import './review-session.css'

interface ReviewSessionProps {
  readonly card: StudyCard
  readonly position: number
  readonly total: number
  /** Page title content (back link, heading) shown on the same compact row as the progress bar. */
  readonly lead?: ReactNode
  readonly onAdvance: (grade: Grade, correct: boolean) => void
}

/**
 * One card, one screen at a time, recall-first: answer -> [confidence,
 * captured before the learner sees whether they were right] -> reveal ->
 * record + advance. The bracketed confidence step and the FSRS self-rating
 * on the reveal are optional settings (both off by default); with self-rating
 * off the grade is derived from correctness. See the study-engine spec for why
 * this ordering matters (retrieval practice + calibration are the two
 * evidence-backed levers this app leans on).
 */
export const ReviewSession = ({ card, position, total, lead, onAdvance }: ReviewSessionProps) => {
  const {
    recordReview,
    state: {
      settings: { selfExplanationEnabled, confidencePromptEnabled, selfRatingPromptEnabled },
    },
  } = useSeshatStore()
  const [step, setStep] = useState<StudyStep>('answer')
  const [attempt, setAttempt] = useState<Attempt>(() => initialAttempt(card.content))
  const [confidence, setConfidence] = useState<ConfidenceRating | null>(null)
  const [correct, setCorrect] = useState(false)
  // `null` means "prompt hidden" (setting off); '' vs non-empty distinguishes
  // an untouched prompt from one the learner explicitly left blank.
  const [selfExplanation, setSelfExplanation] = useState<string | null>(null)
  const promptShownAt = useRef(performance.now())

  // Reset all per-card state whenever a new card is shown.
  useEffect(() => {
    setStep('answer')
    setAttempt(initialAttempt(card.content))
    setConfidence(null)
    setCorrect(false)
    setSelfExplanation(selfExplanationEnabled ? '' : null)
    promptShownAt.current = performance.now()
  }, [card.id, card.content, selfExplanationEnabled])

  const complete = isAttemptComplete(card.content, attempt)

  const submitAnswer = useCallback(
    (answered: Attempt) => {
      if (!isAttemptComplete(card.content, answered)) return
      const next = stepAfterAnswer(confidencePromptEnabled)
      if (next !== 'confidence') {
        // No confidence step: nothing is recorded for it, and correctness is computed now.
        setConfidence(null)
        setCorrect(isCorrect(card.content, answered))
      }
      setStep(next)
    },
    [card.content, confidencePromptEnabled],
  )
  const handleAnswerContinue = useCallback(() => submitAnswer(attempt), [attempt, submitAnswer])

  const handleConfidence = useCallback(
    (rating: ConfidenceRating) => {
      setConfidence(rating)
      setCorrect(isCorrect(card.content, attempt))
      setStep('reveal')
    },
    [attempt, card.content],
  )

  const handleGrade = useCallback(
    (grade: Grade) => {
      const elapsedMs = performance.now() - promptShownAt.current
      const trimmedExplanation =
        selfExplanation !== null && selfExplanation.trim() !== '' ? selfExplanation.trim() : null
      recordReview(card.id, grade, confidence, correct, elapsedMs, trimmedExplanation)
      onAdvance(grade, correct)
    },
    [card.id, confidence, correct, onAdvance, recordReview, selfExplanation],
  )

  // Space presses Continue exactly when a Continue button is on screen and enabled.
  const continueAction = useMemo(() => {
    if (step === 'answer' && card.content.kind !== 'mcq' && complete) return handleAnswerContinue
    if (step === 'reveal' && !selfRatingPromptEnabled) return () => handleGrade(derivedGrade(correct))
    return undefined
  }, [step, card.content.kind, complete, handleAnswerContinue, selfRatingPromptEnabled, handleGrade, correct])

  useStudyShortcuts({
    step,
    selfRatingEnabled: selfRatingPromptEnabled,
    onConfidence: handleConfidence,
    onGrade: handleGrade,
    onContinue: continueAction,
  })

  return (
    <div className="review-session">
      <div className="review-progress" data-testid={TESTIDS.studyProgress}>
        {lead}
        <p className="review-progress-label">
          Card {position + 1} of {total}
        </p>
        <progress
          className="review-progress-track"
          aria-label="Study session progress"
          value={position + 1}
          max={total}
        />
      </div>

      {step === 'answer' && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleAnswerContinue()
          }}
        >
          <CardInput card={card} attempt={attempt} onChange={setAttempt} onCommit={submitAnswer} disabled={false} />
          {/* A multiple-choice pick submits itself, so only the typed kinds need a Continue. */}
          {card.content.kind !== 'mcq' && (
            <div className="study-continue">
              <button type="submit" disabled={!complete} data-testid={TESTIDS.studyContinue}>
                Continue
              </button>
            </div>
          )}
        </form>
      )}

      {step === 'confidence' && (
        <div>
          <CardInput card={card} attempt={attempt} onChange={setAttempt} disabled />
          <ConfidencePrompt onSelect={handleConfidence} />
        </div>
      )}

      {step === 'reveal' && (
        <RevealPanel
          card={card}
          attempt={attempt}
          correct={correct}
          onGrade={handleGrade}
          selfRatingEnabled={selfRatingPromptEnabled}
          selfExplanation={selfExplanation}
          onSelfExplanationChange={setSelfExplanation}
        />
      )}
    </div>
  )
}
