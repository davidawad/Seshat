import { useEffect, useState } from 'react'
import { Legible } from '../../../components/Legible'
import { ShortcutHelp } from '../../../components/ShortcutHelp'
import { useKeybindings } from '../../../lib/useKeybindings'
import { useNumberedShortcut } from '../../../lib/useNumberedShortcut'
import type { SetId } from '../../../types'
import { getBestScore, recordScore } from './bestScore'
import './blast.css'
import { type BlastPair, type BlastQuestion, START_LIVES, buildRound } from './round'

/**
 * How long each asteroid stays on screen before it "hits" (a miss/timeout),
 * in ms. No physics/position tracking — a shrinking timer bar conveys
 * "approaching" well enough, the same simplification match/MatchSession.tsx
 * makes for its own round timing (a plain elapsed-time readout rather than
 * simulated motion).
 */
const ROUND_TIME_MS = 8000

/**
 * How long feedback (correct/wrong/timeout) is held on screen before
 * advancing to the next asteroid or the completion screen — long enough to
 * register what happened, mirroring match/MatchSession.tsx's MISS_DWELL_MS.
 */
const FEEDBACK_DWELL_MS = 900

type AnswerStatus = 'playing' | 'correct' | 'wrong' | 'timeout'
type EndReason = 'lives' | 'cleared'

interface BlastSessionProps {
  readonly setId: SetId
  readonly pairs: readonly BlastPair[]
}

interface BlastAsteroidFieldProps {
  readonly question: BlastQuestion
  readonly roundIndex: number
  readonly status: AnswerStatus
  readonly pickedOption: string | null
  readonly feedback: string
  readonly keyFor: (actionId: string) => string
  readonly onSelect: (option: string) => void
}

/** The live-question view: timer, prompt, feedback, and the asteroid field — split out of `BlastSession` to keep that component's size/complexity in check. */
const BlastAsteroidField = ({
  question,
  roundIndex,
  status,
  pickedOption,
  feedback,
  keyFor,
  onSelect,
}: BlastAsteroidFieldProps) => (
  <>
    <ShortcutHelp
      shortcuts={question.options.map((_, index) => ({
        key: keyFor(`blast.selectOption${index + 1}`),
        label: `Select option ${index + 1}`,
      }))}
    />
    <div className="blast-timer-track" aria-hidden="true">
      <div
        key={roundIndex}
        className={status === 'playing' ? 'blast-timer-bar' : 'blast-timer-bar is-paused'}
        style={{ animationDuration: `${ROUND_TIME_MS}ms` }}
      />
    </div>

    <div className="blast-prompt">
      <p className="blast-prompt-label">Blast the rock that matches:</p>
      <Legible as="p" className="blast-prompt-text">
        {question.prompt}
      </Legible>
    </div>

    <p role="status" aria-live="polite" className="blast-feedback">
      {feedback}
    </p>

    <div className="blast-field">
      {question.options.map((option) => {
        const isPicked = option === pickedOption
        const revealCorrect = status !== 'playing' && option === question.correctOption
        const revealWrongPick = status === 'wrong' && isPicked
        const classNames = ['blast-asteroid']
        if (isPicked) classNames.push('is-picked')
        if (revealCorrect) classNames.push('is-correct')
        if (revealWrongPick) classNames.push('is-wrong')
        return (
          <button
            key={option}
            type="button"
            className={classNames.join(' ')}
            disabled={status !== 'playing'}
            onClick={() => onSelect(option)}
          >
            <Legible as="span" measure={false} className="blast-asteroid-text">
              {option}
            </Legible>
          </button>
        )
      })}
    </div>
  </>
)

interface BlastCompleteProps {
  readonly endReason: EndReason | null
  readonly score: number
  readonly attemptedCount: number
  readonly totalQuestions: number
  readonly onPlayAgain: () => void
}

/** The end-of-run summary — split out of `BlastSession` for the same reason as `BlastAsteroidField` above. */
const BlastComplete = ({ endReason, score, attemptedCount, totalQuestions, onPlayAgain }: BlastCompleteProps) => (
  <div className="illuminated-panel blast-complete" role="status">
    <p className="blast-complete-heading">{endReason === 'lives' ? 'Out of lives.' : 'Cleared the whole set.'}</p>
    <p>Score: {score}</p>
    <p>
      Cards cleared: {attemptedCount} of {totalQuestions}
    </p>
    <button type="button" className="blast-play-again" onClick={onPlayAgain} autoFocus>
      Play again
    </button>
  </div>
)

export const BlastSession = ({ setId, pairs }: BlastSessionProps) => {
  const { key: keyFor } = useKeybindings()
  const [questions, setQuestions] = useState<readonly BlastQuestion[]>(() => buildRound(pairs))
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(START_LIVES)
  const [status, setStatus] = useState<AnswerStatus>('playing')
  const [pickedOption, setPickedOption] = useState<string | null>(null)
  const [attemptedCount, setAttemptedCount] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [endReason, setEndReason] = useState<EndReason | null>(null)
  const [bestAtStart, setBestAtStart] = useState<number | null>(() => getBestScore(setId))
  const [isNewBest, setIsNewBest] = useState(false)

  const totalQuestions = questions.length
  const question = questions[index]

  // Per-question countdown: if the player hasn't answered by ROUND_TIME_MS,
  // the asteroid "hits" — treated the same as a wrong pick (costs a life).
  // Depending on `status` means this effect's cleanup fires the instant the
  // player answers (or the previous timer resolves), so a stale timeout from
  // an already-answered question can never fire for the next one.
  useEffect(() => {
    if (isComplete || status !== 'playing' || question === undefined) return
    const timeoutId = window.setTimeout(() => {
      setLives((l) => l - 1)
      setAttemptedCount((c) => c + 1)
      setStatus('timeout')
      setFeedback(`Time's up — the asteroid for "${question.prompt}" got away.`)
    }, ROUND_TIME_MS)
    return () => window.clearTimeout(timeoutId)
  }, [index, status, isComplete, question])

  // Shared by both "the run just ended" branches below — records the score
  // and flips to the completion screen either way, differing only in why.
  const finishRound = (reason: EndReason) => {
    setEndReason(reason)
    const updatedBest = recordScore(setId, score)
    setIsNewBest(bestAtStart === null || score > bestAtStart)
    setBestAtStart(updatedBest)
    setIsComplete(true)
  }

  // Once an answer is in (correct/wrong/timeout), hold the feedback for a
  // beat, then either move to the next asteroid or end the run — whichever
  // the current lives/index call for.
  useEffect(() => {
    if (status === 'playing' || isComplete) return
    const advanceId = window.setTimeout(() => {
      if (lives <= 0) {
        finishRound('lives')
        return
      }
      if (index + 1 >= totalQuestions) {
        finishRound('cleared')
        return
      }
      setIndex((i) => i + 1)
      setStatus('playing')
      setPickedOption(null)
      setFeedback('')
    }, FEEDBACK_DWELL_MS)
    return () => window.clearTimeout(advanceId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `finishRound` closes over this render's state/props; re-running whenever any of them change is exactly what's wanted.
  }, [status, isComplete, lives, index, totalQuestions, score, setId, bestAtStart])

  const handleSelect = (option: string) => {
    if (status !== 'playing' || question === undefined) return
    setPickedOption(option)
    setAttemptedCount((c) => c + 1)
    if (option === question.correctOption) {
      setScore((s) => s + 1)
      setStatus('correct')
      setFeedback(`Blasted it — "${option}" was the match.`)
    } else {
      setLives((l) => l - 1)
      setStatus('wrong')
      setFeedback(`Wrong rock — "${question.prompt}" doesn't match "${option}".`)
    }
  }

  // Digit-key option select while a question is live.
  useNumberedShortcut(
    'blast.selectOption',
    question?.options.length ?? 0,
    status === 'playing' && question !== undefined,
    (index) => {
      const option = question?.options[index]
      if (option !== undefined) handleSelect(option)
    },
  )

  const playAgain = () => {
    setQuestions(buildRound(pairs))
    setIndex(0)
    setScore(0)
    setLives(START_LIVES)
    setStatus('playing')
    setPickedOption(null)
    setAttemptedCount(0)
    setFeedback('')
    setIsComplete(false)
    setEndReason(null)
    setIsNewBest(false)
    setBestAtStart(getBestScore(setId))
  }

  return (
    <div className="blast-session">
      <div className="blast-status-bar">
        <p className="blast-score">Score: {score}</p>
        <p className="blast-lives">Lives: {lives}</p>
        <p className="blast-best">
          {bestAtStart === null ? 'No personal best yet' : `Best: ${bestAtStart}`}
          {isComplete && isNewBest && ' (new)'}
        </p>
      </div>

      {!isComplete && question !== undefined && (
        <BlastAsteroidField
          question={question}
          roundIndex={index}
          status={status}
          pickedOption={pickedOption}
          feedback={feedback}
          keyFor={keyFor}
          onSelect={handleSelect}
        />
      )}

      {isComplete && (
        <BlastComplete
          endReason={endReason}
          score={score}
          attemptedCount={attemptedCount}
          totalQuestions={totalQuestions}
          onPlayAgain={playAgain}
        />
      )}
    </div>
  )
}
