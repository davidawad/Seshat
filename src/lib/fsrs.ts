import {
  type Card as FsrsCard,
  type Grade as FsrsGrade,
  Rating,
  State,
  createEmptyCard,
  fsrs,
  generatorParameters,
} from 'ts-fsrs'
import type { Grade, SchedulingState } from '../types'

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

const MS_PER_DAY = 24 * 60 * 60 * 1000
// Ramp window: retention only gets boosted once the goal is within this many
// days out. Matches Cepeda et al.'s finding that the useful spacing gap
// shrinks as the retention horizon shrinks — see
// research/learning-science/cepeda-2008.md.
const GOAL_RAMP_DAYS = 14
const GOAL_MAX_RETENTION = 0.95

/**
 * A goal date doesn't change *what* FSRS optimizes for on every review — it
 * tightens the target as the date approaches, and puts a hard ceiling on the
 * next due date so nothing sits unreviewed past it.
 */
export const goalAwareRetention = (desiredRetention: number, now: Date, goalDate: Date | null): number => {
  if (goalDate === null) return desiredRetention
  const daysUntilGoal = (goalDate.getTime() - now.getTime()) / MS_PER_DAY
  if (daysUntilGoal <= 0) return desiredRetention
  const ramp = Math.max(0, Math.min(1, (GOAL_RAMP_DAYS - daysUntilGoal) / GOAL_RAMP_DAYS))
  return desiredRetention + (GOAL_MAX_RETENTION - desiredRetention) * ramp
}

const capDueToGoal = (scheduling: SchedulingState, goalDate: Date | null): SchedulingState => {
  if (goalDate === null) return scheduling
  const due = new Date(scheduling.due)
  if (due.getTime() <= goalDate.getTime()) return scheduling
  return { ...scheduling, due: goalDate.toISOString() }
}

export interface ScheduleReviewResult {
  readonly scheduling: SchedulingState
  readonly retrievabilityAtReview: number | null
}

export const scheduleReview = (
  scheduling: SchedulingState,
  grade: Grade,
  desiredRetention: number,
  now: Date,
  goalDate: Date | null = null,
): ScheduleReviewResult => {
  const engine = scheduler(goalAwareRetention(desiredRetention, now, goalDate))
  const fsrsCard = toFsrsCard(scheduling)
  const retrievabilityAtReview = fsrsCard.reps > 0 ? engine.get_retrievability(fsrsCard, now, false) : null
  const { card } = engine.next(fsrsCard, now, gradeToFsrs[grade])
  return { scheduling: capDueToGoal(fromFsrsCard(card), goalDate), retrievabilityAtReview }
}

export const isDue = (scheduling: SchedulingState, now: Date): boolean =>
  new Date(scheduling.due).getTime() <= now.getTime()
