import { describe, expect, it } from 'vitest'
import { createInitialScheduling, goalAwareRetention, isDue, scheduleReview } from './fsrs'

describe('fsrs scheduling', () => {
  it('creates a new card that is immediately due', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const scheduling = createInitialScheduling(now)
    expect(scheduling.state).toBe('New')
    expect(scheduling.reps).toBe(0)
    expect(isDue(scheduling, now)).toBe(true)
  })

  it('pushes the due date forward after a "good" review', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const initial = createInitialScheduling(now)
    const { scheduling } = scheduleReview(initial, 'good', 0.9, now)
    expect(scheduling.reps).toBe(1)
    expect(new Date(scheduling.due).getTime()).toBeGreaterThan(now.getTime())
  })

  it('schedules a shorter interval after "again" than after "good"', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const initial = createInitialScheduling(now)
    const again = scheduleReview(initial, 'again', 0.9, now)
    const good = scheduleReview(initial, 'good', 0.9, now)
    expect(new Date(again.scheduling.due).getTime()).toBeLessThanOrEqual(new Date(good.scheduling.due).getTime())
  })

  it('leaves retention unchanged with no goal date', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    expect(goalAwareRetention(0.9, now, null)).toBe(0.9)
  })

  it('leaves retention unchanged when the goal is far out', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const goal = new Date('2026-06-01T00:00:00.000Z')
    expect(goalAwareRetention(0.9, now, goal)).toBe(0.9)
  })

  it('ramps retention up toward the max as the goal date nears', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const goalTomorrow = new Date('2026-01-02T00:00:00.000Z')
    const goalInAWeek = new Date('2026-01-08T00:00:00.000Z')
    const retentionTomorrow = goalAwareRetention(0.9, now, goalTomorrow)
    const retentionInAWeek = goalAwareRetention(0.9, now, goalInAWeek)
    expect(retentionTomorrow).toBeGreaterThan(retentionInAWeek)
    expect(retentionTomorrow).toBeLessThanOrEqual(0.95)
  })

  it('never schedules a card due after its set goal date', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const goal = new Date('2026-01-01T12:00:00.000Z')
    const initial = createInitialScheduling(now)
    const { scheduling } = scheduleReview(initial, 'easy', 0.9, now, goal)
    expect(new Date(scheduling.due).getTime()).toBeLessThanOrEqual(goal.getTime())
  })

  it('does not cap the due date when there is no goal', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const initial = createInitialScheduling(now)
    const { scheduling } = scheduleReview(initial, 'easy', 0.9, now, null)
    expect(new Date(scheduling.due).getTime()).toBeGreaterThan(now.getTime())
  })
})
