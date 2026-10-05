import { describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import { newCardId, newSetId } from '../../lib/id'
import type { CardContent, CardId, StudyCard } from '../../types'
import {
  BATCH_SIZE,
  type LearnState,
  RELEARN_GAP,
  accuracyPercent,
  advance,
  allMastered,
  attemptFor,
  canAskChoice,
  countMastery,
  currentCardId,
  currentStage,
  endSession,
  hardestCards,
  isTypedCorrect,
  masteryOf,
  nextRound,
  pickBatch,
  requeue,
  startSession,
  submitAnswer,
} from './learn-session'

const ids = (count: number): CardId[] => Array.from({ length: count }, () => newCardId())
const identity = () => 0.5
const always = () => true

const asking = (state: LearnState): CardId => {
  const id = currentCardId(state)
  if (id === null) throw new Error('no current card')
  return id
}

/** Answers the current question and moves on. */
const answer = (state: LearnState, correct: boolean): LearnState => advance(submitAnswer(state, correct))

const card = (content: CardContent): StudyCard => {
  const now = new Date().toISOString()
  return {
    id: newCardId(),
    setId: newSetId(),
    prompt: 'P',
    promptImage: null,
    content,
    explanation: null,
    sourceRef: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
    scheduling: createInitialScheduling(new Date()),
  }
}

describe('startSession', () => {
  it('opens round 1 with a batch capped at BATCH_SIZE, all not started at the recognition stage', () => {
    const state = startSession(ids(10), always, identity)
    expect(state.round).toBe(1)
    expect(state.phase).toBe('asking')
    expect(state.queue).toHaveLength(BATCH_SIZE)
    expect(state.roundIds).toEqual(state.queue)
    expect(state.entries.every((entry) => masteryOf(entry) === 'not-started' && entry.stage === 'choice')).toBe(true)
  })

  it('starts a card typed when no multiple-choice question can be built for it', () => {
    const [a, b] = ids(2) as [CardId, CardId]
    const state = startSession([a, b], (id) => id === a, identity)
    expect(state.entries.find((entry) => entry.id === a)?.stage).toBe('choice')
    expect(state.entries.find((entry) => entry.id === b)?.stage).toBe('typed')
  })

  it('is done at once for an empty set', () => {
    expect(startSession([], always).phase).toBe('done')
  })
})

describe('pickBatch', () => {
  it('prefers cards already in progress over untouched ones and skips mastered cards', () => {
    const [mastered, learning, fresh] = ids(3) as [CardId, CardId, CardId]
    const base = { choiceable: true, stage: 'choice' as const, misses: 0 }
    const picked = pickBatch(
      [
        { ...base, id: fresh, started: false, mastered: false },
        { ...base, id: mastered, started: true, mastered: true },
        { ...base, id: learning, started: true, mastered: false },
      ],
      1,
      identity,
    )
    expect(picked).toEqual([learning])
  })
})

describe('submitAnswer / advance', () => {
  it('promotes recognition to typed recall on a correct answer, and does not re-ask the card this round', () => {
    const state = startSession(ids(3), always, identity)
    const first = asking(state)
    const feedback = submitAnswer(state, true)
    expect(feedback.phase).toBe('feedback')
    expect(feedback.feedback).toEqual({ cardId: first, stage: 'choice', correct: true })
    const next = advance(feedback)
    expect(next.queue).not.toContain(first)
    expect(next.entries.find((entry) => entry.id === first)).toMatchObject({ stage: 'typed', started: true })
  })

  it('masters a card on a correct typed answer', () => {
    let state = startSession(ids(1), () => false, identity)
    expect(currentStage(state)).toBe('typed')
    state = submitAnswer(state, true)
    expect(state.entries[0]).toMatchObject({ mastered: true, started: true })
  })

  it('demotes a missed typed card to recognition and re-queues it RELEARN_GAP questions later', () => {
    let state = startSession(ids(6), always, identity)
    const target = asking(state)
    state = answer(state, true) // target now typed, out of this round
    // Force the target back into the current round's queue as a typed question.
    state = { ...state, queue: [target, ...state.queue] }
    state = submitAnswer(state, false)
    expect(state.entries.find((entry) => entry.id === target)).toMatchObject({ stage: 'choice', misses: 1 })
    const next = advance(state)
    expect(next.queue[RELEARN_GAP]).toBe(target)
    expect(next.phase).toBe('asking')
  })

  it('keeps an unchoiceable card typed after a miss', () => {
    const state = submitAnswer(
      startSession(ids(2), () => false, identity),
      false,
    )
    expect(state.entries.every((entry) => entry.stage === 'typed')).toBe(true)
  })

  it('counts answers and accuracy', () => {
    let state = startSession(ids(4), always, identity)
    state = answer(state, true)
    state = answer(state, false)
    expect(state.answered).toBe(2)
    expect(state.correctCount).toBe(1)
    expect(accuracyPercent(state)).toBe(50)
  })

  it('ignores answers outside the asking phase', () => {
    const state = startSession(ids(2), always, identity)
    const feedback = submitAnswer(state, true)
    expect(submitAnswer(feedback, false)).toBe(feedback)
    expect(advance(state)).toBe(state)
  })

  it('ends the round with a summary once every queued question is answered correctly', () => {
    let state = startSession(ids(2), always, identity)
    state = answer(state, true)
    state = answer(state, true)
    expect(state.phase).toBe('round-summary')
    expect(state.roundIds).toHaveLength(2)
  })
})

describe('requeue', () => {
  it('inserts after RELEARN_GAP cards, or last when fewer remain', () => {
    const [a, b, c, miss] = ids(4) as [CardId, CardId, CardId, CardId]
    expect(requeue([a, b, c], miss)).toEqual([a, b, miss, c])
    expect(requeue([a], miss)).toEqual([a, miss])
    expect(requeue([], miss)).toEqual([miss])
  })
})

describe('rounds and completion', () => {
  it('walks a small set from not-started to mastered over rounds, then finishes', () => {
    let state = startSession(ids(2), always, identity)
    // Round 1: recognition correct for both.
    state = answer(answer(state, true), true)
    expect(state.phase).toBe('round-summary')
    expect(countMastery(state.entries)).toEqual({ mastered: 0, learning: 2, notStarted: 0 })
    // Round 2: typed correct for both.
    state = nextRound(state, identity)
    expect(state.round).toBe(2)
    expect(state.phase).toBe('asking')
    expect(currentStage(state)).toBe('typed')
    state = answer(answer(state, true), true)
    expect(state.phase).toBe('round-summary')
    expect(allMastered(state)).toBe(true)
    expect(countMastery(state.entries)).toEqual({ mastered: 2, learning: 0, notStarted: 0 })
    // Nothing left: the next round is the end.
    expect(nextRound(state, identity).phase).toBe('done')
  })

  it('later rounds pick up unstarted cards after the in-progress ones', () => {
    let state = startSession(ids(8), always, identity)
    for (let i = 0; i < BATCH_SIZE; i++) state = answer(state, true)
    state = nextRound(state, identity)
    const inProgress = new Set(state.entries.filter((entry) => entry.started).map((entry) => entry.id))
    expect(state.roundIds.filter((id) => inProgress.has(id))).toHaveLength(BATCH_SIZE)
    expect(state.roundIds).toHaveLength(BATCH_SIZE)
    expect(countMastery(state.entries).notStarted).toBe(2)
  })

  it('nextRound is a no-op outside a round summary', () => {
    const state = startSession(ids(2), always, identity)
    expect(nextRound(state)).toBe(state)
  })

  it('endSession stops immediately and keeps the progress made', () => {
    const state = endSession(answer(startSession(ids(3), always, identity), true))
    expect(state.phase).toBe('done')
    expect(countMastery(state.entries).learning).toBe(1)
  })
})

describe('hardestCards', () => {
  it('lists missed cards worst first and omits clean ones', () => {
    let state = startSession(ids(3), always, identity)
    const first = asking(state)
    state = answer(state, false)
    state = answer(state, true)
    const worst = hardestCards(state.entries)
    expect(worst.map((entry) => entry.id)).toEqual([first])
  })
})

describe('isTypedCorrect', () => {
  it('reuses short-answer grading, including accepted alternatives and normalization', () => {
    const c = card({ kind: 'short-answer', answer: 'Paris', acceptableAnswers: ['City of Light'], answerImage: null })
    expect(isTypedCorrect(c, '  paris. ')).toBe(true)
    expect(isTypedCorrect(c, 'city of light')).toBe(true)
    expect(isTypedCorrect(c, 'Lyon')).toBe(false)
    expect(isTypedCorrect(c, '')).toBe(false)
  })

  it('grades cloze and mcq cards by their correct answer text', () => {
    const cloze = card({ kind: 'cloze', text: 'The capital is {{Paris}}.' })
    expect(isTypedCorrect(cloze, 'paris')).toBe(true)
    const mcq = card({ kind: 'mcq', options: ['Rome', 'Paris'], correctIndex: 1 })
    expect(isTypedCorrect(mcq, 'Paris')).toBe(true)
    expect(isTypedCorrect(mcq, 'Rome')).toBe(false)
  })
})

const textCard = (n: number): StudyCard =>
  card({ kind: 'short-answer', answer: `A${n}`, acceptableAnswers: [], answerImage: null })

describe('canAskChoice', () => {
  it('needs at least two distinct other answers to build distractors from', () => {
    const [a, b, c, d] = [1, 2, 3, 4].map(textCard) as [StudyCard, StudyCard, StudyCard, StudyCard]
    expect(canAskChoice(a, [a])).toBe(false)
    expect(canAskChoice(a, [a, b])).toBe(false)
    expect(canAskChoice(a, [a, b, c])).toBe(true)
    expect(canAskChoice(a, [a, b, c, d])).toBe(true)
  })

  it('does not count another card that shares the same answer', () => {
    const a = textCard(1)
    const twin = card({ kind: 'short-answer', answer: 'A1', acceptableAnswers: [], answerImage: null })
    expect(canAskChoice(a, [a, twin, textCard(2)])).toBe(false)
  })
})

describe('attemptFor', () => {
  it('maps what was answered onto the card kind for the shared reveal panel', () => {
    expect(attemptFor(textCard(1), 'x')).toEqual({ kind: 'short-answer', response: 'x' })
    expect(attemptFor(card({ kind: 'cloze', text: 'A {{b}} c' }), 'x')).toEqual({ kind: 'cloze', response: 'x' })
    const mcq = card({ kind: 'mcq', options: ['Rome', 'Paris'], correctIndex: 1 })
    expect(attemptFor(mcq, 'Paris')).toEqual({ kind: 'mcq', selectedIndex: 1 })
    expect(attemptFor(mcq, 'Madrid')).toEqual({ kind: 'mcq', selectedIndex: null })
  })
})
