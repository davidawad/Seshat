/**
 * Pure geometry helpers for the image-occlusion region editor's
 * pointer-drag rectangle drawing. Kept free of DOM/React so the coordinate
 * math is unit-testable without a real browser.
 */

export interface PointPct {
  readonly xPct: number
  readonly yPct: number
}

export interface RectPct {
  readonly xPct: number
  readonly yPct: number
  readonly widthPct: number
  readonly heightPct: number
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/**
 * Converts a pointer's client coordinates into percentages of `bounds`
 * (typically an element's `getBoundingClientRect()`), clamped to [0, 100]
 * so a drag that continues past the image's edge still produces a region
 * that stays within it.
 */
export const clientPointToPct = (
  clientX: number,
  clientY: number,
  bounds: { readonly left: number; readonly top: number; readonly width: number; readonly height: number },
): PointPct => {
  const xPct = bounds.width === 0 ? 0 : ((clientX - bounds.left) / bounds.width) * 100
  const yPct = bounds.height === 0 ? 0 : ((clientY - bounds.top) / bounds.height) * 100
  return { xPct: clamp(xPct, 0, 100), yPct: clamp(yPct, 0, 100) }
}

/**
 * Normalizes two drag corner points into a top-left-origin rectangle
 * (percentages), since a drag can move in any direction from its start
 * point.
 */
export const rectFromPoints = (a: PointPct, b: PointPct): RectPct => ({
  xPct: Math.min(a.xPct, b.xPct),
  yPct: Math.min(a.yPct, b.yPct),
  widthPct: Math.abs(a.xPct - b.xPct),
  heightPct: Math.abs(a.yPct - b.yPct),
})

/** Minimum drawn size (in %, each dimension) for a drag to count as an intentional region rather than an accidental click. */
export const MIN_REGION_SIZE_PCT = 1.5

/** Whether a drawn rectangle is large enough to keep as a region. */
export const isRegionRectSignificant = (rect: RectPct): boolean =>
  rect.widthPct >= MIN_REGION_SIZE_PCT && rect.heightPct >= MIN_REGION_SIZE_PCT
