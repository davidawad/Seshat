import { shuffle } from '../test-mode/generate-test'
import { cardFrontBack } from '../study/card-summary'
import { type Attempt, isCorrect, normalizeAnswer } from '../study/grading'
import { textCards } from '../study/text-cards'
import type { CardId, StudyCard } from '../../types'

/**
 * Pure state machine for Learn mode, decoupled from React. A session works
 * through a set in rounds of a small batch: each card is first asked as
 * multiple choice (recognition), promoted to typed recall after a correct
 * answer, and mastered after a correct typed answer. A wrong answer demotes
 * the card to recognition and re-queues it a couple of questions later in the
 * same round. Every transition is a pure function of (state, input) so the
 * whole flow is unit-testable without rendering anything.
 */

/** Cards per round: small enough to hold in working memory, large enough to space re-asks. */
export const BATCH_SIZE = 6

/** How many questions pass before a missed card comes back within its round. */
export const RELEARN_GAP = 2

/** Recognition (multiple choice) or generative recall (typed). */
export type Stage = 'choice' | 'typed'

export type Mastery = 'not-started' | 'learning' | 'mastered'

export type Phase = 'asking' | 'feedback' | 'round-summary' | 'done'

export interface Entry {
  readonly id: CardId
  /** False when the set cannot supply distractors, so the card is typed from the start and never demoted. */
  readonly choiceable: boolean
  readonly stage: Stage
  readonly started: boolean
  readonly mastered: boolean
  readonly misses: number
}

export interface Feedback {
  readonly cardId: CardId
  readonly stage: Stage
  readonly correct: boolean
}

export interface LearnState {
  readonly entries: readonly Entry[]
  /** The ids still to ask this round; the head is the current question (re-queued misses are inserted). */
  readonly queue: readonly CardId[]
  /** The cards chosen for the current round, for its summary. */
  readonly roundIds: readonly CardId[]
  readonly round: number
  readonly phase: Phase
  readonly feedback: Feedback | null
  readonly answered: number
  readonly correctCount: number
}

/** A question needs the answer plus at least two distractors, else it is near-trivial and the card starts typed. */
export const MIN_CHOICE_OPTIONS = 3

export const masteryOf = (entry: Entry): Mastery =>
  entry.mastered ? 'mastered' : entry.started ? 'learning' : 'not-started'

const update = (entries: readonly Entry[], id: CardId, patch: Partial<Entry>): readonly Entry[] =>
  entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))

const entryOf = (state: LearnState, id: CardId): Entry | undefined => state.entries.find((entry) => entry.id === id)

/**
 * The next round's cards: unmastered cards, those already in progress first (finish what was
 * started), then untouched ones, up to `size`; shuffled so order within a round is not predictable.
 */
export const pickBatch = (
  entries: readonly Entry[],
  size: number = BATCH_SIZE,
  random: () => number = Math.random,
): readonly CardId[] => {
  const open = entries.filter((entry) => !entry.mastered)
  const ordered = [...open.filter((entry) => entry.started), ...open.filter((entry) => !entry.started)]
  return shuffle(
    ordered.slice(0, size).map((entry) => entry.id),
    random,
  )
}

const beginRound = (state: LearnState, round: number, random: () => number): LearnState => {
  const batch = pickBatch(state.entries, BATCH_SIZE, random)
  return {
    ...state,
    queue: batch,
    roundIds: batch,
    round,
    phase: batch.length === 0 ? 'done' : 'asking',
    feedback: null,
  }
}

/** Starts a session over `cardIds`. `canChoice(id)` says whether a multiple-choice question can be built for it. */
export const startSession = (
  cardIds: readonly CardId[],
  canChoice: (id: CardId) => boolean,
  random: () => number = Math.random,
): LearnState =>
  beginRound(
    {
      entries: cardIds.map((id) => {
        const choiceable = canChoice(id)
        return {
          id,
          choiceable,
          stage: choiceable ? 'choice' : 'typed',
          started: false,
          mastered: false,
          misses: 0,
        }
      }),
      queue: [],
      roundIds: [],
      round: 1,
      phase: 'asking',
      feedback: null,
      answered: 0,
      correctCount: 0,
    },
    1,
    random,
  )

/** The card being asked right now (null outside the asking/feedback phases). */
export const currentCardId = (state: LearnState): CardId | null =>
  state.phase === 'asking' || state.phase === 'feedback' ? (state.queue[0] ?? null) : null

/** The stage of the current question. */
export const currentStage = (state: LearnState): Stage | null => {
  const id = currentCardId(state)
  return id === null ? null : (entryOf(state, id)?.stage ?? null)
}

/**
 * Applies one answer to the current question. Correct: recognition promotes to typed recall,
 * typed recall masters the card. Incorrect: the card falls back to recognition (when that is
 * possible) and counts a miss. The queue is left alone until `advance`, so feedback still shows
 * the question that was asked.
 */
export const submitAnswer = (state: LearnState, correct: boolean): LearnState => {
  const id = currentCardId(state)
  if (state.phase !== 'asking' || id === null) return state
  const entry = entryOf(state, id)
  if (entry === undefined) return state

  const patch: Partial<Entry> = correct
    ? entry.stage === 'choice'
      ? { started: true, stage: 'typed' }
      : { started: true, mastered: true }
    : { started: true, misses: entry.misses + 1, stage: entry.choiceable ? 'choice' : 'typed' }

  return {
    ...state,
    entries: update(state.entries, id, patch),
    phase: 'feedback',
    feedback: { cardId: id, stage: entry.stage, correct },
    answered: state.answered + 1,
    correctCount: state.correctCount + (correct ? 1 : 0),
  }
}

/** Where a missed card re-enters the rest of the round: `RELEARN_GAP` questions later, or last. */
export const requeue = (rest: readonly CardId[], id: CardId): readonly CardId[] => {
  const at = Math.min(RELEARN_GAP, rest.length)
  return [...rest.slice(0, at), id, ...rest.slice(at)]
}

/** Leaves feedback: next question, or the round summary once the round's queue is empty. */
export const advance = (state: LearnState): LearnState => {
  if (state.phase !== 'feedback' || state.feedback === null) return state
  const rest = state.queue.slice(1)
  const queue = state.feedback.correct ? rest : requeue(rest, state.feedback.cardId)
  return queue.length === 0
    ? { ...state, queue, phase: 'round-summary', feedback: null }
    : { ...state, queue, phase: 'asking', feedback: null }
}

/** Whether every card has been mastered. */
export const allMastered = (state: LearnState): boolean => state.entries.every((entry) => entry.mastered)

/** From a round summary: starts the next round, or finishes when nothing is left to learn. */
export const nextRound = (state: LearnState, random: () => number = Math.random): LearnState =>
  state.phase !== 'round-summary' ? state : beginRound(state, state.round + 1, random)

/** Ends the session immediately (the learner chose to stop). */
export const endSession = (state: LearnState): LearnState => ({ ...state, phase: 'done', feedback: null, queue: [] })

export interface MasteryCounts {
  readonly mastered: number
  readonly learning: number
  readonly notStarted: number
}

export const countMastery = (entries: readonly Entry[]): MasteryCounts =>
  entries.reduce<MasteryCounts>(
    (counts, entry) => {
      const level = masteryOf(entry)
      return {
        mastered: counts.mastered + (level === 'mastered' ? 1 : 0),
        learning: counts.learning + (level === 'learning' ? 1 : 0),
        notStarted: counts.notStarted + (level === 'not-started' ? 1 : 0),
      }
    },
    { mastered: 0, learning: 0, notStarted: 0 },
  )

/** Accuracy as a whole percent (0 when nothing was answered). */
export const accuracyPercent = (state: LearnState): number =>
  state.answered === 0 ? 0 : Math.round((state.correctCount / state.answered) * 100)

/** The cards missed most this session, worst first (cards never missed are omitted). */
export const hardestCards = (entries: readonly Entry[], limit = 5): readonly Entry[] =>
  entries
    .filter((entry) => entry.misses > 0)
    .toSorted((a, b) => b.misses - a.misses)
    .slice(0, limit)

/**
 * Grades a typed answer. Short-answer and cloze cards reuse Study's grading (including accepted
 * alternatives); a multiple-choice card has no typed form of its own, so the typed text is compared
 * with its correct option.
 */
export const isTypedCorrect = (card: StudyCard, response: string): boolean => {
  const { content } = card
  switch (content.kind) {
    case 'short-answer':
      return isCorrect(content, { kind: 'short-answer', response })
    case 'cloze':
      return isCorrect(content, { kind: 'cloze', response })
    case 'mcq':
      return normalizeAnswer(response) === normalizeAnswer(content.options[content.correctIndex] ?? '')
    case 'image-occlusion':
      return false
  }
}

/**
 * Whether a multiple-choice question with enough distinct distractors can be built for `card` from
 * the rest of its set. A tiny or repetitive set cannot, so its cards start at typed recall.
 */
export const canAskChoice = (card: StudyCard, cards: readonly StudyCard[]): boolean => {
  const own = cardFrontBack(card).back
  const others = new Set(
    textCards(cards)
      .filter((other) => other.id !== card.id)
      .map((other) => cardFrontBack(other).back),
  )
  others.delete(own)
  return others.size >= MIN_CHOICE_OPTIONS - 1
}

/**
 * The study `Attempt` matching what the learner answered (typed text, or the chosen option's text),
 * so Study's reveal panel can show "Your answer / Correct answer" for any text card kind.
 */
export const attemptFor = (card: StudyCard, response: string): Attempt => {
  const { content } = card
  switch (content.kind) {
    case 'short-answer':
      return { kind: 'short-answer', response }
    case 'cloze':
      return { kind: 'cloze', response }
    case 'mcq': {
      const at = content.options.indexOf(response)
      return { kind: 'mcq', selectedIndex: at === -1 ? null : at }
    }
    case 'image-occlusion':
      return { kind: 'image-occlusion', targetRegionId: content.occlusions[0]?.id ?? '', response }
  }
}
