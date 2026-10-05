import { describe, expect, it } from 'vitest'
import { exportedSetSchema } from '../../types'
import { TRY_SAMPLE_SET } from './try-sample'

describe('TRY_SAMPLE_SET', () => {
  it('is a valid export of exactly ten cards', () => {
    expect(exportedSetSchema.safeParse(TRY_SAMPLE_SET).success).toBe(true)
    expect(TRY_SAMPLE_SET.cards).toHaveLength(10)
  })

  it('cites a source for every card', () => {
    for (const card of TRY_SAMPLE_SET.cards) expect(card.sourceRef, card.prompt).toBeTruthy()
  })

  it('is neutral: no patent or MPEP content', () => {
    expect(JSON.stringify(TRY_SAMPLE_SET).toLowerCase()).not.toMatch(/patent|mpep|uspto/)
  })

  it('shows more than one card kind', () => {
    expect(new Set(TRY_SAMPLE_SET.cards.map((card) => card.content.kind)).size).toBeGreaterThanOrEqual(3)
  })
})
