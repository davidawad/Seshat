/**
 * Pure model behind the diagram editor: rectangle moves/resizes (pointer and
 * keyboard), an undo/redo history, and the plan that turns a list of labelled
 * regions into one card per label. No DOM and no React, so all of it is unit
 * tested directly.
 */
import { describePosition } from '../../lib/diagram'
import type { OcclusionRegion } from '../../types'
import { MIN_REGION_SIZE_PCT, type PointPct, type RectPct } from './region-geometry'

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))
const round1 = (value: number): number => Math.round(value * 10) / 10

/** Keeps a rectangle inside the image and at least the minimum size, rounded to 0.1%. */
export const clampRect = (rect: RectPct): RectPct => {
  const widthPct = round1(clamp(rect.widthPct, MIN_REGION_SIZE_PCT, 100))
  const heightPct = round1(clamp(rect.heightPct, MIN_REGION_SIZE_PCT, 100))
  return {
    widthPct,
    heightPct,
    xPct: round1(clamp(rect.xPct, 0, 100 - widthPct)),
    yPct: round1(clamp(rect.yPct, 0, 100 - heightPct)),
  }
}

/** Translates a rectangle, stopping at the image edges (the size never changes). */
export const moveRect = (rect: RectPct, dxPct: number, dyPct: number): RectPct =>
  clampRect({ ...rect, xPct: rect.xPct + dxPct, yPct: rect.yPct + dyPct })

/** Grows/shrinks from the top-left anchor; stops at the minimum size and the image edges. */
export const resizeRect = (rect: RectPct, dwPct: number, dhPct: number): RectPct =>
  clampRect({
    ...rect,
    widthPct: clamp(rect.widthPct + dwPct, MIN_REGION_SIZE_PCT, 100 - rect.xPct),
    heightPct: clamp(rect.heightPct + dhPct, MIN_REGION_SIZE_PCT, 100 - rect.yPct),
  })

export type Corner = 'nw' | 'ne' | 'sw' | 'se'

/** Pointer-drag of one corner: the opposite corner stays fixed, the dragged one follows `point`. */
export const resizeFromCorner = (rect: RectPct, corner: Corner, point: PointPct): RectPct => {
  const fixedX = corner === 'nw' || corner === 'sw' ? rect.xPct + rect.widthPct : rect.xPct
  const fixedY = corner === 'nw' || corner === 'ne' ? rect.yPct + rect.heightPct : rect.yPct
  const left = Math.min(fixedX, point.xPct)
  const top = Math.min(fixedY, point.yPct)
  const width = Math.max(MIN_REGION_SIZE_PCT, Math.abs(point.xPct - fixedX))
  const height = Math.max(MIN_REGION_SIZE_PCT, Math.abs(point.yPct - fixedY))
  // When the pointer is on the near side and the minimum size kicks in, keep the fixed corner fixed.
  return clampRect({
    xPct: point.xPct < fixedX ? left : fixedX,
    yPct: point.yPct < fixedY ? top : fixedY,
    widthPct: width,
    heightPct: height,
  })
}

/** Pointer-drag of the whole rectangle: `origin` is where it was when the drag began. */
export const dragRect = (origin: RectPct, from: PointPct, to: PointPct): RectPct =>
  moveRect(origin, to.xPct - from.xPct, to.yPct - from.yPct)

export const KEY_STEP_PCT = 1
export const KEY_STEP_LARGE_PCT = 5

export type KeyEdit =
  | { readonly kind: 'move'; readonly dx: number; readonly dy: number }
  | { readonly kind: 'resize'; readonly dw: number; readonly dh: number }
  | { readonly kind: 'delete' }

const ARROW: Record<string, readonly [number, number] | undefined> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/**
 * What a key does to a focused region: arrows move, Shift+arrows resize,
 * Delete/Backspace removes. Ctrl/Cmd multiplies the step by five.
 * Anything else (including Tab) is not an edit.
 */
export const keyToEdit = (key: string, mods: { readonly shift: boolean; readonly large: boolean }): KeyEdit | null => {
  if (key === 'Delete' || key === 'Backspace') return { kind: 'delete' }
  const dir = ARROW[key]
  if (dir === undefined) return null
  const step = mods.large ? KEY_STEP_LARGE_PCT : KEY_STEP_PCT
  const [x, y] = dir
  return mods.shift ? { kind: 'resize', dw: x * step, dh: y * step } : { kind: 'move', dx: x * step, dy: y * step }
}

/** Applies a keyboard edit to a rectangle (delete is the caller's job). */
export const applyKeyEdit = (rect: RectPct, edit: Exclude<KeyEdit, { kind: 'delete' }>): RectPct =>
  edit.kind === 'move' ? moveRect(rect, edit.dx, edit.dy) : resizeRect(rect, edit.dw, edit.dh)

export const regionRect = (region: OcclusionRegion): RectPct => ({
  xPct: region.xPct,
  yPct: region.yPct,
  widthPct: region.widthPct,
  heightPct: region.heightPct,
})

/** A fresh region's default rectangle, offset per existing region so additions do not stack exactly. */
export const defaultRegionRect = (existingCount: number): RectPct => {
  const offset = (existingCount * 8) % 50
  return { xPct: 10 + offset, yPct: 10 + offset, widthPct: 25, heightPct: 15 }
}

// ---------------------------------------------------------------------------
// Undo / redo
// ---------------------------------------------------------------------------

export interface History<T> {
  readonly past: readonly T[]
  readonly present: T
  readonly future: readonly T[]
  /** Edits sharing a key (typing in one label, nudging one region) fold into a single undo step. */
  readonly lastKey: string | null
}

export const HISTORY_LIMIT = 100

export const createHistory = <T>(present: T): History<T> => ({ past: [], present, future: [], lastKey: null })

export const commit = <T>(history: History<T>, next: T, key: string | null = null): History<T> => {
  if (Object.is(next, history.present)) return history
  if (key !== null && key === history.lastKey) return { ...history, present: next, future: [] }
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    lastKey: key,
  }
}

export const canUndo = (history: History<unknown>): boolean => history.past.length > 0
export const canRedo = (history: History<unknown>): boolean => history.future.length > 0

export const undo = <T>(history: History<T>): History<T> => {
  const previous = history.past[history.past.length - 1]
  if (previous === undefined) return history
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    lastKey: null,
  }
}

export const redo = <T>(history: History<T>): History<T> => {
  const [next, ...rest] = history.future
  if (next === undefined) return history
  return { past: [...history.past, history.present], present: next, future: rest, lastKey: null }
}

// ---------------------------------------------------------------------------
// One card per label
// ---------------------------------------------------------------------------

export interface ExistingDiagramCard {
  readonly cardId: string
  /** The region the card asks about; undefined on a legacy card (it asks about the first region). */
  readonly askedRegionId: string | undefined
}

export interface DiagramCardPlan {
  readonly add: readonly OcclusionRegion[]
  readonly update: readonly { readonly cardId: string; readonly region: OcclusionRegion }[]
  readonly remove: readonly string[]
}

/**
 * Matches regions to the diagram's existing cards by region id so each label
 * keeps its card (and FSRS history) across edits: new regions add a card,
 * known regions update theirs, cards whose region is gone are removed.
 * Legacy cards without an `askedRegionId` claim the first region still
 * unclaimed, in order.
 */
export const planDiagramCards = (
  regions: readonly OcclusionRegion[],
  existing: readonly ExistingDiagramCard[],
): DiagramCardPlan => {
  const claimed = new Map<string, string>()
  for (const card of existing) {
    if (card.askedRegionId !== undefined && regions.some((r) => r.id === card.askedRegionId)) {
      if (!claimed.has(card.askedRegionId)) claimed.set(card.askedRegionId, card.cardId)
    }
  }
  const claimedCards = new Set(claimed.values())
  for (const card of existing.filter((c) => c.askedRegionId === undefined)) {
    const free = regions.find((region) => !claimed.has(region.id))
    if (free !== undefined) {
      claimed.set(free.id, card.cardId)
      claimedCards.add(card.cardId)
    }
  }
  return {
    add: regions.filter((region) => !claimed.has(region.id)),
    update: regions.flatMap((region) => {
      const cardId = claimed.get(region.id)
      return cardId === undefined ? [] : [{ cardId, region }]
    }),
    remove: existing.filter((card) => !claimedCards.has(card.cardId)).map((card) => card.cardId),
  }
}

/** Regions that cannot become cards yet: no label. Returns their 1-based numbers. */
export const unlabeledRegionNumbers = (regions: readonly OcclusionRegion[]): readonly number[] =>
  regions.flatMap((region, index) => (region.label.trim() === '' ? [index + 1] : []))

/** Text for a screen-reader status after an edit: "upper left, 25% wide by 15% high". */
export const describeRegionRect = (rect: RectPct): string =>
  `${describePosition(rect)}, ${Math.round(rect.widthPct)}% wide by ${Math.round(rect.heightPct)}% high`
