import { describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import type { CardId } from '../../types'
import {
  type GradeRecord,
  canUndo,
  createFlashcardRun,
  createFlashcardSession,
  currentCardId,
  gradeRun,
  undoRun,
} from './session'

const ids = (...values: string[]): CardId[] => values as unknown as CardId[]
const scheduling = createInitialScheduling(new Date('2024-01-01T00:00:00.000Z'))

const record = (cardId: string, known: boolean, tracked = true): GradeRecord => ({
  cardId: cardId as unknown as CardId,
  known,
  previousScheduling: tracked ? scheduling : null,
  reviewedAt: tracked ? `2024-01-01T00:00:0${cardId === 'a' ? 1 : 2}.000Z` : null,
})

const freshRun = () => createFlashcardRun(createFlashcardSession(ids('a', 'b', 'c'), 'original'))

describe('flashcard run undo stack', () => {
  it('starts with nothing to undo', () => {
    expect(canUndo(freshRun())).toBe(false)
  })

  it('undoRun on an empty history is a no-op', () => {
    const run = freshRun()
    expect(undoRun(run)).toEqual({ run, undone: null })
  })

  it('gradeRun advances the session and pushes the record', () => {
    const next = gradeRun(freshRun(), record('a', true))
    expect(next.session.position).toBe(1)
    expect(next.session.knownIds).toEqual(['a'])
    expect(next.history).toEqual([record('a', true)])
    expect(canUndo(next)).toBe(true)
  })

  it('undo restores position and takes a known card back out of knownIds', () => {
    const graded = gradeRun(freshRun(), record('a', true))
    const { run, undone } = undoRun(graded)
    expect(undone).toEqual(record('a', true))
    expect(run).toEqual(freshRun())
    expect(currentCardId(run.session)).toBe('a')
  })

  it('undo takes an unknown card back out of unknownIds', () => {
    const graded = gradeRun(freshRun(), record('a', false))
    const { run } = undoRun(graded)
    expect(run.session.unknownIds).toEqual([])
    expect(run.session.position).toBe(0)
  })

  it('undoes repeatedly, newest grade first, reversing each counter', () => {
    let run = gradeRun(freshRun(), record('a', true))
    run = gradeRun(run, record('b', false))
    run = gradeRun(run, record('c', true))
    expect(run.session.position).toBe(3)

    const first = undoRun(run)
    expect(first.undone?.cardId).toBe('c')
    expect(first.run.session.knownIds).toEqual(['a'])
    expect(first.run.session.unknownIds).toEqual(['b'])

    const second = undoRun(first.run)
    expect(second.undone?.cardId).toBe('b')
    expect(second.run.session.unknownIds).toEqual([])
    expect(second.run.session.position).toBe(1)

    const third = undoRun(second.run)
    expect(third.undone?.cardId).toBe('a')
    expect(third.run).toEqual(freshRun())
    expect(canUndo(third.run)).toBe(false)
  })

  it('carries untracked records (null scheduling) through the stack', () => {
    const { undone } = undoRun(gradeRun(freshRun(), record('a', true, false)))
    expect(undone).toEqual({ cardId: 'a', known: true, previousScheduling: null, reviewedAt: null })
  })
})
