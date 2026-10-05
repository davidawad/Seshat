import { useCallback, useMemo, useRef, useState } from 'react'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import type { SetId, StudyCard } from '../../types'
import { derivedGrade } from '../study/grading'
import { LearnQuestion, type Resolution } from './LearnQuestion'
import { FinalSummary, RoundSummary } from './LearnSummaries'
import {
  type LearnState,
  advance,
  canAskChoice,
  countMastery,
  currentCardId,
  currentStage,
  endSession,
  nextRound,
  startSession,
  submitAnswer,
} from './learn-session'
import './learn.css'

interface LearnRunProps {
  readonly setId: SetId
  /** The set's text cards. */
  readonly cards: readonly StudyCard[]
  readonly onRestart: () => void
}

/** One run through the state machine in `learn-session.ts`, plus the review-recording tail. */
const LearnRun = ({ setId, cards: liveCards, onRestart }: LearnRunProps) => {
  const { recordReview } = useSeshatStore()
  // Snapshot per run: reviews recorded mid-session change the live cards, and distractors must not reshuffle.
  const [cards] = useState(liveCards)
  const [state, setState] = useState<LearnState>(() =>
    startSession(
      cards.map((card) => card.id),
      (id) => {
        const card = cards.find((candidate) => candidate.id === id)
        return card !== undefined && canAskChoice(card, cards)
      },
    ),
  )
  const startedAt = useRef(performance.now())
  const [elapsedMs, setElapsedMs] = useState(0)
  const byId = useMemo(() => new Map(cards.map((card) => [card.id as string, card] as const)), [cards])

  const cardId = currentCardId(state)
  const stage = currentStage(state)
  const card = cardId === null ? undefined : byId.get(cardId)

  // Typed answers are the real retrieval attempts, so they always feed FSRS; a recognition answer only
  // does when it was a miss (a lapse). Mastery itself follows correctness, whatever self-rating said.
  const handleDone = useCallback(
    (resolution: Resolution) => {
      if (cardId === null) return
      if (stage === 'typed' || !resolution.correct) {
        const grade = stage === 'typed' ? resolution.grade : derivedGrade(false)
        recordReview(cardId, grade, resolution.confidence, resolution.correct, resolution.elapsedMs)
      }
      setState((current) => advance(submitAnswer(current, resolution.correct)))
    },
    [cardId, recordReview, stage],
  )

  const finish = useCallback(() => {
    setElapsedMs(performance.now() - startedAt.current)
    setState(endSession)
  }, [])
  const next = useCallback(() => {
    const following = nextRound(state)
    if (following.phase === 'done') setElapsedMs(performance.now() - startedAt.current)
    setState(following)
  }, [state])

  if (state.phase === 'done') {
    return <FinalSummary state={state} cards={byId} elapsedMs={elapsedMs} setId={setId} onRestart={onRestart} />
  }
  if (state.phase === 'round-summary') {
    return <RoundSummary state={state} cards={byId} onNext={next} onFinish={finish} />
  }
  if (card === undefined || stage === null) return null

  const counts = countMastery(state.entries)
  return (
    <div className="review-session learn-session">
      <div className="review-progress" data-testid={TESTIDS.learnProgress}>
        <p className="review-progress-label">
          Round {state.round} · {counts.mastered} of {state.entries.length} mastered
        </p>
        <progress
          className="review-progress-track"
          aria-label="Terms mastered"
          value={counts.mastered}
          max={state.entries.length}
        />
      </div>
      <LearnQuestion
        key={`${state.round}-${state.answered}`}
        card={card}
        cards={cards}
        stage={stage}
        onDone={handleDone}
      />
      <button type="button" className="learn-finish" data-testid={TESTIDS.learnFinish} onClick={finish}>
        End session
      </button>
    </div>
  )
}

interface LearnSessionProps {
  readonly setId: SetId
  readonly cards: readonly StudyCard[]
}

/** Rounds of small batches: multiple choice, then typed recall, with a summary after each round and at the end. */
export const LearnSession = ({ setId, cards }: LearnSessionProps) => {
  const [run, setRun] = useState(0)
  return <LearnRun key={run} setId={setId} cards={cards} onRestart={() => setRun((current) => current + 1)} />
}
