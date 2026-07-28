import {
  type Card as FsrsCard,
  type Grade as FsrsGrade,
  Rating,
  State,
  createEmptyCard,
  fsrs,
  generatorParameters,
} from 'ts-fsrs'
import type { ConfidenceRating, Grade, ReviewLogEntry, SchedulingState } from '../types'

/**
 * The only module that talks to ts-fsrs directly. Everything else in the
 * app works with the serializable `SchedulingState` shape from types.ts —
 * see research/learning-science/fsrs-scheduling.md for why FSRS was chosen
 * over a fixed SM-2-style scheduler.
 */

const stateToFsrs: Record<SchedulingState['state'], State> = {
  New: State.New,
  Learning: State.Learning,
  Review: State.Review,
  Relearning: State.Relearning,
}

const stateFromFsrs: Record<State, SchedulingState['state']> = {
  [State.New]: 'New',
  [State.Learning]: 'Learning',
  [State.Review]: 'Review',
  [State.Relearning]: 'Relearning',
}

const gradeToFsrs: Record<Grade, FsrsGrade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
}

const toFsrsCard = (scheduling: SchedulingState): FsrsCard => ({
  due: new Date(scheduling.due),
  stability: scheduling.stability,
  difficulty: scheduling.difficulty,
  elapsed_days: 0,
  scheduled_days: scheduling.scheduledDays,
  learning_steps: scheduling.learningSteps,
  reps: scheduling.reps,
  lapses: scheduling.lapses,
  state: stateToFsrs[scheduling.state],
  ...(scheduling.lastReview === null ? {} : { last_review: new Date(scheduling.lastReview) }),
})

const fromFsrsCard = (card: FsrsCard): SchedulingState => ({
  due: card.due.toISOString(),
  stability: card.stability,
  difficulty: card.difficulty,
  scheduledDays: card.scheduled_days,
  learningSteps: card.learning_steps,
  reps: card.reps,
  lapses: card.lapses,
  state: stateFromFsrs[card.state],
  lastReview: card.last_review === undefined ? null : card.last_review.toISOString(),
})

const scheduler = (desiredRetention: number) => fsrs(generatorParameters({ request_retention: desiredRetention }))

export const createInitialScheduling = (now: Date): SchedulingState => fromFsrsCard(createEmptyCard(now))

export interface ScheduleReviewResult {
  readonly scheduling: SchedulingState
  readonly retrievabilityAtReview: number | null
}

export const scheduleReview = (
  scheduling: SchedulingState,
  grade: Grade,
  desiredRetention: number,
  now: Date,
): ScheduleReviewResult => {
  const engine = scheduler(desiredRetention)
  const fsrsCard = toFsrsCard(scheduling)
  const retrievabilityAtReview = fsrsCard.reps > 0 ? engine.get_retrievability(fsrsCard, now, false) : null
  const { card } = engine.next(fsrsCard, now, gradeToFsrs[grade])
  return { scheduling: fromFsrsCard(card), retrievabilityAtReview }
}

export const isDue = (scheduling: SchedulingState, now: Date): boolean =>
  new Date(scheduling.due).getTime() <= now.getTime()

export const buildReviewLogEntry = (
  cardId: ReviewLogEntry['cardId'],
  deckId: ReviewLogEntry['deckId'],
  grade: Grade,
  confidence: ConfidenceRating | null,
  correct: boolean,
  retrievabilityAtReview: number | null,
  elapsedMs: number,
  reviewedAt: Date,
): ReviewLogEntry => ({
  cardId,
  deckId,
  reviewedAt: reviewedAt.toISOString(),
  grade,
  confidence,
  correct,
  retrievabilityAtReview,
  elapsedMs,
})
