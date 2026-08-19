/**
 * Pure grid logic for Blocks: a Connect-Four-style placement board, not real
 * Quizlet's drag-and-drop tetromino grid. Each earned piece is a single
 * filled cell (not a multi-cell tetromino shape) that drops into the lowest
 * open cell of a column the player picks. Kept free of React/DOM so it's
 * fully unit-testable — see grid.test.ts.
 *
 * Representation: a column's fill state is just its height (how many cells
 * are filled from the bottom) — there's never a gap in a column, because
 * pieces only ever drop in from the top and line-clears remove a full layer
 * across every column at once. That invariant is what lets "heights only"
 * stand in for a full 2D occupancy grid.
 */

export const GRID_COLUMNS = 6
export const GRID_ROWS = 8

export const POINTS_PER_PIECE = 10
export const POINTS_PER_CLEAR = 50

export const createEmptyGrid = (columns: number = GRID_COLUMNS): number[] => Array(columns).fill(0)

/** Whether a piece can currently drop into `column` (it isn't already stacked to the top). */
export const canPlace = (columns: readonly number[], column: number, rows: number = GRID_ROWS): boolean =>
  column >= 0 && column < columns.length && (columns[column] ?? 0) < rows

export interface PlacementResult {
  readonly columns: readonly number[]
  readonly clearedRow: boolean
  readonly clearedColumn: boolean
}

/**
 * Drops one piece into `column`. If that completes the column (fills it to
 * the top), the whole column clears (empties back to 0). Otherwise, if the
 * row the piece just landed on is now filled across every column, that row
 * clears (every column's height drops by 1, shifting everything above down
 * — a simplified line-clear). At most one of the two clears can happen from
 * a single placement, since a column can only reach "full" by way of a
 * placement that either completes it outright or completes a row first.
 * A no-op (columns unchanged, no clear) is returned if `column` can't
 * accept a piece — callers should guard with `canPlace` first, but this
 * fails safe rather than throwing.
 */
export const placePiece = (columns: readonly number[], column: number, rows: number = GRID_ROWS): PlacementResult => {
  if (!canPlace(columns, column, rows)) {
    return { columns: [...columns], clearedRow: false, clearedColumn: false }
  }

  const next = [...columns]
  const landedHeight = (next[column] ?? 0) + 1
  next[column] = landedHeight

  if (landedHeight === rows) {
    next[column] = 0
    return { columns: next, clearedRow: false, clearedColumn: true }
  }

  const landedRow = landedHeight - 1 // 0-indexed from the bottom
  const rowComplete = next.every((height) => height >= landedRow + 1)
  if (rowComplete) {
    return { columns: next.map((height) => height - 1), clearedRow: true, clearedColumn: false }
  }

  return { columns: next, clearedRow: false, clearedColumn: false }
}

/**
 * Defensive "board is stuck" check for the game-over condition described in
 * the design ("the grid fills up with no clearable lines"). In practice a
 * column that reaches the top always clears itself immediately (see
 * `placePiece`), so a column can never be observed sitting at max height
 * between turns — this can't actually trigger in normal play. It's kept as
 * a fallback so a future change to the clear rules (or an edge case this
 * pass didn't anticipate) fails safe into a completion screen instead of a
 * grid nothing can be placed on.
 */
export const isGridFull = (columns: readonly number[], rows: number = GRID_ROWS): boolean =>
  columns.every((height) => height >= rows)

/** Points earned for one placement: a flat amount for the piece, plus a bonus if it cleared a line. */
export const pointsForPlacement = (result: Pick<PlacementResult, 'clearedRow' | 'clearedColumn'>): number =>
  POINTS_PER_PIECE + (result.clearedRow || result.clearedColumn ? POINTS_PER_CLEAR : 0)
