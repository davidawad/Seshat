import { describe, expect, it } from 'vitest'
import { createInitialScheduling, isDue, scheduleReview } from './fsrs'

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
})
