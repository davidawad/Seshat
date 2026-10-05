import { describe, expect, it } from 'vitest'
import type { OcclusionRegion } from '../../types'
import {
  applyKeyEdit,
  canRedo,
  canUndo,
  clampRect,
  commit,
  createHistory,
  defaultRegionRect,
  describeRegionRect,
  dragRect,
  keyToEdit,
  moveRect,
  planDiagramCards,
  redo,
  resizeFromCorner,
  resizeRect,
  undo,
  unlabeledRegionNumbers,
} from './diagram-model'
import { MIN_REGION_SIZE_PCT } from './region-geometry'

const rect = { xPct: 10, yPct: 20, widthPct: 30, heightPct: 40 }
const region = (id: string, label = id): OcclusionRegion => ({ id, ...rect, label })

describe('clampRect / moveRect / resizeRect', () => {
  it('keeps a rectangle inside the image', () => {
    expect(clampRect({ xPct: 90, yPct: -5, widthPct: 30, heightPct: 40 })).toEqual({
      xPct: 70,
      yPct: 0,
      widthPct: 30,
      heightPct: 40,
    })
  })

  it('enforces the minimum size and rounds to 0.1', () => {
    expect(clampRect({ xPct: 1.234, yPct: 1, widthPct: 0, heightPct: 200 })).toEqual({
      xPct: 1.2,
      yPct: 0,
      widthPct: MIN_REGION_SIZE_PCT,
      heightPct: 100,
    })
  })

  it('moves by a delta and stops at the edges without changing size', () => {
    expect(moveRect(rect, 5, -5)).toEqual({ ...rect, xPct: 15, yPct: 15 })
    expect(moveRect(rect, 500, 500)).toEqual({ ...rect, xPct: 70, yPct: 60 })
    expect(moveRect(rect, -500, -500)).toEqual({ ...rect, xPct: 0, yPct: 0 })
  })

  it('resizes from the top-left anchor, between the minimum size and the image edge', () => {
    expect(resizeRect(rect, 5, -5)).toEqual({ ...rect, widthPct: 35, heightPct: 35 })
    expect(resizeRect(rect, 500, 500)).toEqual({ ...rect, widthPct: 90, heightPct: 80 })
    expect(resizeRect(rect, -500, -500)).toEqual({
      ...rect,
      widthPct: MIN_REGION_SIZE_PCT,
      heightPct: MIN_REGION_SIZE_PCT,
    })
  })
})

describe('pointer drags', () => {
  it('moves the whole rectangle by the pointer delta', () => {
    expect(dragRect(rect, { xPct: 20, yPct: 20 }, { xPct: 25, yPct: 30 })).toEqual({ ...rect, xPct: 15, yPct: 30 })
  })

  it('resizes from a corner while the opposite corner stays put', () => {
    expect(resizeFromCorner(rect, 'se', { xPct: 60, yPct: 80 })).toEqual({
      xPct: 10,
      yPct: 20,
      widthPct: 50,
      heightPct: 60,
    })
    expect(resizeFromCorner(rect, 'nw', { xPct: 0, yPct: 0 })).toEqual({
      xPct: 0,
      yPct: 0,
      widthPct: 40,
      heightPct: 60,
    })
  })

  it('flips when the corner is dragged past the opposite one', () => {
    expect(resizeFromCorner(rect, 'se', { xPct: 5, yPct: 10 })).toEqual({
      xPct: 5,
      yPct: 10,
      widthPct: 5,
      heightPct: 10,
    })
  })
})

describe('keyToEdit / applyKeyEdit', () => {
  const plain = { shift: false, large: false }

  it('maps arrows to moves, Shift+arrows to resizes, Ctrl/Cmd to a 5x step', () => {
    expect(keyToEdit('ArrowRight', plain)).toEqual({ kind: 'move', dx: 1, dy: 0 })
    expect(keyToEdit('ArrowUp', plain)).toEqual({ kind: 'move', dx: 0, dy: -1 })
    expect(keyToEdit('ArrowDown', { shift: true, large: false })).toEqual({ kind: 'resize', dw: 0, dh: 1 })
    expect(keyToEdit('ArrowLeft', { shift: false, large: true })).toEqual({ kind: 'move', dx: -5, dy: 0 })
  })

  it('maps Delete and Backspace to delete and ignores other keys', () => {
    expect(keyToEdit('Delete', plain)).toEqual({ kind: 'delete' })
    expect(keyToEdit('Backspace', plain)).toEqual({ kind: 'delete' })
    expect(keyToEdit('Tab', plain)).toBeNull()
    expect(keyToEdit('a', plain)).toBeNull()
  })

  it('applies a move and a resize to a rectangle', () => {
    expect(applyKeyEdit(rect, { kind: 'move', dx: 1, dy: 0 })).toEqual({ ...rect, xPct: 11 })
    expect(applyKeyEdit(rect, { kind: 'resize', dw: -1, dh: 1 })).toEqual({ ...rect, widthPct: 29, heightPct: 41 })
  })
})

describe('helpers', () => {
  it('offsets default rectangles so additions do not stack', () => {
    expect(defaultRegionRect(0)).not.toEqual(defaultRegionRect(1))
    expect(defaultRegionRect(0).xPct).toBe(10)
  })

  it('describes a rectangle in words', () => {
    expect(describeRegionRect({ xPct: 0, yPct: 0, widthPct: 20, heightPct: 10 })).toBe(
      'upper left, 20% wide by 10% high',
    )
  })

  it('lists unlabeled regions by 1-based number', () => {
    expect(unlabeledRegionNumbers([region('a', 'x'), region('b', '  '), region('c', '')])).toEqual([2, 3])
  })
})

describe('history', () => {
  it('undoes and redoes, and a new edit clears the redo stack', () => {
    let h = createHistory('a')
    expect(canUndo(h)).toBe(false)
    h = commit(h, 'b')
    h = commit(h, 'c')
    expect(h.present).toBe('c')
    h = undo(h)
    expect(h.present).toBe('b')
    expect(canRedo(h)).toBe(true)
    h = redo(h)
    expect(h.present).toBe('c')
    h = undo(undo(h))
    expect(h.present).toBe('a')
    h = commit(h, 'z')
    expect(canRedo(h)).toBe(false)
    expect(undo(h).present).toBe('a')
  })

  it('folds edits that share a key into one undo step', () => {
    let h = createHistory('')
    h = commit(h, 'H', 'label:1')
    h = commit(h, 'He', 'label:1')
    h = commit(h, 'Hea', 'label:1')
    expect(h.past).toHaveLength(1)
    h = commit(h, 'Hea!', 'label:2')
    expect(undo(h).present).toBe('Hea')
    expect(undo(undo(h)).present).toBe('')
  })

  it('ignores a no-op commit and undo/redo at the ends', () => {
    const h = createHistory('a')
    expect(commit(h, 'a')).toBe(h)
    expect(undo(h)).toBe(h)
    expect(redo(h)).toBe(h)
  })
})

describe('planDiagramCards', () => {
  it('adds a card per region when the diagram is new', () => {
    const plan = planDiagramCards([region('a'), region('b')], [])
    expect(plan.add.map((r) => r.id)).toEqual(['a', 'b'])
    expect(plan.update).toEqual([])
    expect(plan.remove).toEqual([])
  })

  it('keeps the card of a surviving region, adds new ones, removes cards of deleted regions', () => {
    const regions = [region('a'), region('c')]
    const plan = planDiagramCards(regions, [
      { cardId: 'card-a', askedRegionId: 'a' },
      { cardId: 'card-b', askedRegionId: 'b' },
    ])
    expect(plan.update).toEqual([{ cardId: 'card-a', region: regions[0] }])
    expect(plan.add.map((r) => r.id)).toEqual(['c'])
    expect(plan.remove).toEqual(['card-b'])
  })

  it('lets a legacy card (no askedRegionId) claim the first unclaimed region', () => {
    const regions = [region('a'), region('b')]
    const plan = planDiagramCards(regions, [{ cardId: 'legacy', askedRegionId: undefined }])
    expect(plan.update).toEqual([{ cardId: 'legacy', region: regions[0] }])
    expect(plan.add.map((r) => r.id)).toEqual(['b'])
    expect(plan.remove).toEqual([])
  })

  it('removes a duplicate card for the same region', () => {
    const plan = planDiagramCards(
      [region('a')],
      [
        { cardId: 'one', askedRegionId: 'a' },
        { cardId: 'two', askedRegionId: 'a' },
      ],
    )
    expect(plan.update.map((u) => u.cardId)).toEqual(['one'])
    expect(plan.remove).toEqual(['two'])
  })
})
