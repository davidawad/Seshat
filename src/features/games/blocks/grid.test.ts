import { describe, expect, it } from 'vitest'
import {
  canPlace,
  createEmptyGrid,
  isGridFull,
  placePiece,
  pointsForPlacement,
  POINTS_PER_CLEAR,
  POINTS_PER_PIECE,
} from './grid'

describe('createEmptyGrid', () => {
  it('creates a grid of zero-height columns', () => {
    expect(createEmptyGrid(6)).toEqual([0, 0, 0, 0, 0, 0])
  })
})

describe('canPlace', () => {
  it('allows placement in a column under the row cap', () => {
    expect(canPlace([0, 3], 1, 8)).toBe(true)
  })

  it('disallows placement in a column at the row cap', () => {
    expect(canPlace([8, 3], 0, 8)).toBe(false)
  })

  it('disallows placement in an out-of-range column', () => {
    expect(canPlace([0, 0], -1, 8)).toBe(false)
    expect(canPlace([0, 0], 2, 8)).toBe(false)
  })
})

describe('placePiece', () => {
  it('increments the target column height by one', () => {
    const result = placePiece([0, 0, 0], 1, 8)
    expect(result.columns).toEqual([0, 1, 0])
    expect(result.clearedRow).toBe(false)
    expect(result.clearedColumn).toBe(false)
  })

  it('is a no-op when the target column cannot accept a piece', () => {
    const result = placePiece([8, 0], 0, 8)
    expect(result.columns).toEqual([8, 0])
    expect(result.clearedRow).toBe(false)
    expect(result.clearedColumn).toBe(false)
  })

  it('clears a column when it fills to the row cap', () => {
    const result = placePiece([7, 3, 5], 0, 8)
    expect(result.clearedColumn).toBe(true)
    expect(result.clearedRow).toBe(false)
    expect(result.columns).toEqual([0, 3, 5])
  })

  it('clears the bottom row once every column has a piece at that row', () => {
    // A 3-column, 8-row grid where columns 0 and 1 already have one piece
    // (row 0 filled there); placing the third piece in column 2 completes
    // row 0 across all three columns.
    const result = placePiece([1, 1, 0], 2, 8)
    expect(result.clearedRow).toBe(true)
    expect(result.clearedColumn).toBe(false)
    // Every column loses exactly the completed bottom layer.
    expect(result.columns).toEqual([0, 0, 0])
  })

  it('shifts higher layers down when a lower row clears', () => {
    // Columns 0 and 1 are taller than column 2; placing in column 2
    // completes row 0 only, so every column just drops by one layer.
    const result = placePiece([3, 4, 0], 2, 8)
    expect(result.clearedRow).toBe(true)
    expect(result.columns).toEqual([2, 3, 0])
  })

  it('does not clear a row that is only complete for some columns', () => {
    // Column 2 is still empty, so the row this piece lands on (row 0) isn't
    // filled across every column yet.
    const result = placePiece([0, 2, 0], 0, 8)
    expect(result.clearedRow).toBe(false)
    expect(result.clearedColumn).toBe(false)
    expect(result.columns).toEqual([1, 2, 0])
  })

  it('does not mutate its input', () => {
    const columns = [0, 1, 2]
    const snapshot = [...columns]
    placePiece(columns, 0, 8)
    expect(columns).toEqual(snapshot)
  })
})

describe('isGridFull', () => {
  it('is true only when every column is at the row cap', () => {
    expect(isGridFull([8, 8, 8], 8)).toBe(true)
    expect(isGridFull([8, 7, 8], 8)).toBe(false)
  })
})

describe('pointsForPlacement', () => {
  it('awards the base amount for a placement with no clear', () => {
    expect(pointsForPlacement({ clearedRow: false, clearedColumn: false })).toBe(POINTS_PER_PIECE)
  })

  it('adds the clear bonus when a row clears', () => {
    expect(pointsForPlacement({ clearedRow: true, clearedColumn: false })).toBe(POINTS_PER_PIECE + POINTS_PER_CLEAR)
  })

  it('adds the clear bonus when a column clears', () => {
    expect(pointsForPlacement({ clearedRow: false, clearedColumn: true })).toBe(POINTS_PER_PIECE + POINTS_PER_CLEAR)
  })
})
