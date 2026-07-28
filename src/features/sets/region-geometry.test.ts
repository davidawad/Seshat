import { describe, expect, it } from 'vitest'
import { MIN_REGION_SIZE_PCT, clientPointToPct, isRegionRectSignificant, rectFromPoints } from './region-geometry'

const bounds = { left: 100, top: 50, width: 200, height: 100 }

describe('clientPointToPct', () => {
  it('converts a point inside the bounds to percentages', () => {
    expect(clientPointToPct(200, 100, bounds)).toEqual({ xPct: 50, yPct: 50 })
  })

  it('clamps a point left/above the bounds to 0', () => {
    expect(clientPointToPct(0, 0, bounds)).toEqual({ xPct: 0, yPct: 0 })
  })

  it('clamps a point right/below the bounds to 100', () => {
    expect(clientPointToPct(9999, 9999, bounds)).toEqual({ xPct: 100, yPct: 100 })
  })

  it('does not divide by zero for a degenerate (zero-size) bounds rect', () => {
    expect(clientPointToPct(50, 50, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ xPct: 0, yPct: 0 })
  })
})

describe('rectFromPoints', () => {
  it('normalizes a drag that goes top-left to bottom-right', () => {
    expect(rectFromPoints({ xPct: 10, yPct: 10 }, { xPct: 40, yPct: 30 })).toEqual({
      xPct: 10,
      yPct: 10,
      widthPct: 30,
      heightPct: 20,
    })
  })

  it('normalizes a drag that goes bottom-right to top-left', () => {
    expect(rectFromPoints({ xPct: 40, yPct: 30 }, { xPct: 10, yPct: 10 })).toEqual({
      xPct: 10,
      yPct: 10,
      widthPct: 30,
      heightPct: 20,
    })
  })

  it('produces a zero-size rect for a click with no drag', () => {
    expect(rectFromPoints({ xPct: 20, yPct: 20 }, { xPct: 20, yPct: 20 })).toEqual({
      xPct: 20,
      yPct: 20,
      widthPct: 0,
      heightPct: 0,
    })
  })
})

describe('isRegionRectSignificant', () => {
  it('rejects a rect below the minimum size in either dimension', () => {
    expect(isRegionRectSignificant({ xPct: 0, yPct: 0, widthPct: 0, heightPct: 0 })).toBe(false)
    expect(isRegionRectSignificant({ xPct: 0, yPct: 0, widthPct: MIN_REGION_SIZE_PCT, heightPct: 0 })).toBe(false)
  })

  it('accepts a rect at or above the minimum size in both dimensions', () => {
    expect(
      isRegionRectSignificant({ xPct: 0, yPct: 0, widthPct: MIN_REGION_SIZE_PCT, heightPct: MIN_REGION_SIZE_PCT }),
    ).toBe(true)
    expect(isRegionRectSignificant({ xPct: 0, yPct: 0, widthPct: 20, heightPct: 20 })).toBe(true)
  })
})
