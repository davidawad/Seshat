import { useCallback, useEffect, useRef, useState } from 'react'
import { useSeshatStore } from '../../lib/store'
import type { ConfidenceRating, Grade, StudyCard } from '../../types'
import { CardInput } from './CardInput'
import { type Attempt, GRADE_ORDER, initialAttempt, isAttemptComplete, isCorrect } from './grading'
import { RevealPanel } from './RevealPanel'

type Step = 'answer' | 'confidence' | 'reveal'

const CONFIDENCE_OPTIONS: readonly { readonly value: ConfidenceRating; readonly label: string }[] = [
  { value: 'guessed', label: 'Guessed' },
  { value: 'unsure', label: 'Unsure' },
  { value: 'sure', label: 'Sure' },
]

interface ReviewSessionProps {
  readonly card: StudyCard
  readonly position: number
  readonly total: number
  readonly onAdvance: () => void
}

/**
 * One card, one screen at a time, recall-first: answer -> confidence
 * (captured before the learner sees whether they were right) -> reveal +
 * FSRS self-rating -> record + advance. See the study-engine spec for why
 * this ordering matters (retrieval practice + calibration are the two
 * evidence-backed levers this app leans on).
 */
export const ReviewSession = ({ card, position, total, onAdvance }: ReviewSessionProps) => {
  const { recordReview } = useSeshatStore()
  const [step, setStep] = useState<Step>('answer')
  const [attempt, setAttempt] = useState<Attempt>(() => initialAttempt(card.content))
  const [confidence, setConfidence] = useState<ConfidenceRating | null>(null)
  const [correct, setCorrect] = useState(false)
  const promptShownAt = useRef(performance.now())

  // Reset all per-card state whenever a new card is shown.
  useEffect(() => {
    setStep('answer')
    setAttempt(initialAttempt(card.content))
    setConfidence(null)
    setCorrect(false)
    promptShownAt.current = performance.now()
  }, [card.id, card.content])

  const complete = isAttemptComplete(card.content, attempt)

  const handleAnswerContinue = useCallback(() => {
    if (!complete) return
    setStep('confidence')
  }, [complete])

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
      recordReview(card.id, grade, confidence, correct, elapsedMs)
      onAdvance()
    },
    [card.id, confidence, correct, onAdvance, recordReview],
  )

  // Number-key shortcuts (1-3 confidence, 1-4 grade) — skipped while a text
  // input is focused so digits keep typing into short-answer/cloze fields.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (step === 'confidence') {
        const option = CONFIDENCE_OPTIONS[Number(event.key) - 1]
        if (option !== undefined) handleConfidence(option.value)
      } else if (step === 'reveal') {
        const grade = GRADE_ORDER[Number(event.key) - 1]
        if (grade !== undefined) handleGrade(grade)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [step, handleConfidence, handleGrade])

  return (
    <div className="review-session">
      <p className="review-progress">
        Card {position + 1} of {total}
      </p>

      {step === 'answer' && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleAnswerContinue()
          }}
        >
          <CardInput card={card} attempt={attempt} onChange={setAttempt} disabled={false} />
          <button type="submit" disabled={!complete}>
            Continue
          </button>
        </form>
      )}

      {step === 'confidence' && (
        <div>
          <CardInput card={card} attempt={attempt} onChange={setAttempt} disabled />
          <fieldset className="review-confidence">
            <legend>How confident are you in that answer?</legend>
            <div className="confidence-options">
              {CONFIDENCE_OPTIONS.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  autoFocus={index === 0}
                  onClick={() => handleConfidence(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {step === 'reveal' && <RevealPanel card={card} attempt={attempt} correct={correct} onGrade={handleGrade} />}
    </div>
  )
}
