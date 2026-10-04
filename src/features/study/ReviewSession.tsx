import { useCallback, useEffect, useRef, useState } from 'react'
import { Legible } from '../../components/Legible'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import { NAV_OPTION_ATTRIBUTE, useOptionNavigation } from '../../lib/useOptionNavigation'
import type { ConfidenceRating, Grade, StudyCard } from '../../types'
import { CardInput } from './CardInput'
import { type Attempt, type StudyStep, initialAttempt, isAttemptComplete, isCorrect, stepAfterAnswer } from './grading'
import { RevealPanel } from './RevealPanel'
import { CONFIDENCE_OPTIONS, useStudyShortcuts } from './useStudyShortcuts'
import './review-session.css'

interface ReviewSessionProps {
  readonly card: StudyCard
  readonly position: number
  readonly total: number
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
export const ReviewSession = ({ card, position, total, onAdvance }: ReviewSessionProps) => {
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
  // Highlighted confidence option for arrow-style navigation (see useOptionNavigation).
  const [confidenceIndex, setConfidenceIndex] = useState(0)
  const confidenceRef = useRef<HTMLDivElement>(null)

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

  const handleAnswerContinue = useCallback(() => {
    if (!complete) return
    const next = stepAfterAnswer(confidencePromptEnabled)
    if (next === 'confidence') {
      setConfidenceIndex(0)
    } else {
      // No confidence step: nothing is recorded for it, and correctness is computed now.
      setConfidence(null)
      setCorrect(isCorrect(card.content, attempt))
    }
    setStep(next)
  }, [attempt, card.content, complete, confidencePromptEnabled])

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

  const confirmConfidence = useCallback(
    (index: number) => {
      const option = CONFIDENCE_OPTIONS[index]
      if (option !== undefined) handleConfidence(option.value)
    },
    [handleConfidence],
  )
  useOptionNavigation({
    count: CONFIDENCE_OPTIONS.length,
    index: confidenceIndex,
    onIndexChange: setConfidenceIndex,
    onConfirm: confirmConfidence,
    orientation: 'horizontal',
    enabled: step === 'confidence',
    containerRef: confidenceRef,
  })

  useStudyShortcuts({
    step,
    selfRatingEnabled: selfRatingPromptEnabled,
    onConfidence: handleConfidence,
    onGrade: handleGrade,
  })

  return (
    <div className="review-session">
      <div className="review-progress" data-testid={TESTIDS.studyProgress}>
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
          <Legible className="illuminated-panel">
            <CardInput card={card} attempt={attempt} onChange={setAttempt} disabled={false} />
          </Legible>
          <button type="submit" disabled={!complete} data-testid={TESTIDS.studyContinue}>
            Continue
          </button>
        </form>
      )}

      {step === 'confidence' && (
        <div>
          <Legible className="illuminated-panel">
            <CardInput card={card} attempt={attempt} onChange={setAttempt} disabled />
          </Legible>
          <fieldset className="review-confidence">
            <legend>How confident are you in that answer?</legend>
            <div ref={confidenceRef} className="confidence-options">
              {CONFIDENCE_OPTIONS.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  autoFocus={index === 0}
                  data-testid={option.testId}
                  onClick={() => handleConfidence(option.value)}
                  onFocus={() => setConfidenceIndex(index)}
                  {...{ [NAV_OPTION_ATTRIBUTE]: '' }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {step === 'reveal' && (
        <div className="illuminated-panel">
          <RevealPanel
            card={card}
            attempt={attempt}
            correct={correct}
            onGrade={handleGrade}
            selfRatingEnabled={selfRatingPromptEnabled}
            selfExplanation={selfExplanation}
            onSelfExplanationChange={setSelfExplanation}
          />
        </div>
      )}
    </div>
  )
}
