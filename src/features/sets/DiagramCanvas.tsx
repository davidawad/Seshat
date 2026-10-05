import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import { CardImage } from '../../components/CardImage'
import { describePosition } from '../../lib/diagram'
import { TESTIDS } from '../../lib/testids'
import type { OcclusionRegion } from '../../types'
import { type Corner, dragRect, regionRect, resizeFromCorner } from './diagram-model'
import {
  type PointPct,
  type RectPct,
  clientPointToPct,
  isRegionRectSignificant,
  rectFromPoints,
} from './region-geometry'
import type { DiagramDraft, FocusRequest } from './use-diagram-editor'

type Gesture =
  | { readonly kind: 'draw'; readonly a: PointPct; readonly b: PointPct }
  | { readonly kind: 'move'; readonly id: string; readonly origin: RectPct; readonly from: PointPct }
  | { readonly kind: 'resize'; readonly id: string; readonly corner: Corner; readonly origin: RectPct }

const CORNERS: readonly Corner[] = ['nw', 'ne', 'sw', 'se']
const ARROW_KEYS =
  'ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown Delete'

const place = (rect: RectPct) => ({
  left: `${rect.xPct}%`,
  top: `${rect.yPct}%`,
  width: `${rect.widthPct}%`,
  height: `${rect.heightPct}%`,
})

/** The rectangle a gesture would produce if it ended at `point`. */
const gestureRect = (gesture: Gesture, point: PointPct): RectPct =>
  gesture.kind === 'draw'
    ? rectFromPoints(gesture.a, point)
    : gesture.kind === 'move'
      ? dragRect(gesture.origin, gesture.from, point)
      : resizeFromCorner(gesture.origin, gesture.corner, point)

const gestureFor = (target: HTMLElement, region: OcclusionRegion | undefined, point: PointPct): Gesture => {
  if (region === undefined) return { kind: 'draw', a: point, b: point }
  const origin = regionRect(region)
  const corner = target.closest<HTMLElement>('[data-corner]')?.dataset['corner'] as Corner | undefined
  return corner === undefined
    ? { kind: 'move', id: region.id, origin, from: point }
    : { kind: 'resize', id: region.id, corner, origin }
}

interface DiagramCanvasProps {
  readonly draft: DiagramDraft
  readonly alt: string
  readonly describedBy: string
  readonly selectedId: string | undefined
  readonly focusRequest: FocusRequest | null
  readonly onFocusHandled: () => void
  readonly onSelect: (id: string) => void
  readonly onDraw: (rect: RectPct) => void
  readonly onRectChange: (id: string, rect: RectPct) => void
  readonly onRegionKey: (region: OcclusionRegion, event: ReactKeyboardEvent<HTMLElement>) => void
}

/**
 * The image with its editable regions. Pointer: drag empty space to draw, drag a region to move it, drag a
 * corner handle to resize. Keyboard: every region is a focusable button (see `onRegionKey`). The in-flight
 * gesture lives here and only commits one rectangle when the pointer is released, so a drag is one undo step.
 */
export const DiagramCanvas = ({
  draft,
  alt,
  describedBy,
  selectedId,
  focusRequest,
  onFocusHandled,
  onSelect,
  onDraw,
  onRectChange,
  onRegionKey,
}: DiagramCanvasProps) => {
  const [gesture, setGesture] = useState<Gesture | null>(null)
  const [livePoint, setLivePoint] = useState<PointPct | null>(null)
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const regionEls = useRef(new Map<string, HTMLElement>())

  useEffect(() => {
    if (focusRequest === null) return
    const el = focusRequest.id === null ? canvasRef.current : regionEls.current.get(focusRequest.id)
    el?.focus()
    onFocusHandled()
  }, [focusRequest, onFocusHandled, draft.regions])

  const pointOf = (event: ReactPointerEvent<HTMLDivElement>): PointPct =>
    clientPointToPct(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    const id = target.closest<HTMLElement>('[data-region-id]')?.dataset['regionId']
    const region = draft.regions.find((candidate) => candidate.id === id)
    const point = pointOf(event)
    event.currentTarget.setPointerCapture(event.pointerId)
    if (region !== undefined) onSelect(region.id)
    setGesture(gestureFor(target, region, point))
    setLivePoint(point)
  }

  const endGesture = (event: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (gesture === null) return
    const done = gesture
    setGesture(null)
    setLivePoint(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    if (cancelled) return
    const rect = gestureRect(done, pointOf(event))
    if (done.kind === 'draw') {
      if (isRegionRectSignificant(rect)) onDraw(rect)
    } else if (JSON.stringify(rect) !== JSON.stringify(done.origin)) {
      onRectChange(done.id, rect)
    }
  }

  const live = gesture !== null && livePoint !== null ? gestureRect(gesture, livePoint) : null

  return (
    <div
      ref={canvasRef}
      className="diagram-canvas"
      role="group"
      tabIndex={-1}
      aria-label={`Diagram canvas: ${alt}. ${draft.regions.length} region${draft.regions.length === 1 ? '' : 's'}.`}
      aria-describedby={describedBy}
      data-testid={TESTIDS.diagramCanvas}
      onPointerDown={handlePointerDown}
      onPointerMove={(event) => gesture !== null && setLivePoint(pointOf(event))}
      onPointerUp={(event) => endGesture(event, false)}
      onPointerCancel={(event) => endGesture(event, true)}
      onDragStart={(event) => event.preventDefault()}
    >
      <CardImage image={draft.image} imageDataUrl={draft.imageDataUrl} alt="" className="diagram-canvas-image" />
      {draft.regions.map((region, index) => {
        const isSelected = region.id === selectedId
        const moving = gesture !== null && gesture.kind !== 'draw' && gesture.id === region.id
        const rect = moving && live !== null ? live : regionRect(region)
        const label = region.label.trim() === '' ? 'no label yet' : region.label
        return (
          <div
            key={region.id}
            ref={(el) => {
              if (el === null) regionEls.current.delete(region.id)
              else regionEls.current.set(region.id, el)
            }}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={`Region ${index + 1}: ${label}, ${describePosition(rect)}`}
            aria-keyshortcuts={ARROW_KEYS}
            data-region-id={region.id}
            data-testid={TESTIDS.diagramRegion}
            className={isSelected ? 'diagram-region is-selected' : 'diagram-region'}
            style={place(rect)}
            onFocus={() => onSelect(region.id)}
            onKeyDown={(event) => onRegionKey(region, event)}
          >
            <span className="diagram-region-badge" aria-hidden="true">
              {index + 1}
              {region.label.trim() === '' ? '' : `: ${region.label}`}
            </span>
            {isSelected &&
              CORNERS.map((corner) => (
                <span key={corner} className={`diagram-handle is-${corner}`} data-corner={corner} aria-hidden="true" />
              ))}
          </div>
        )
      })}
      {gesture?.kind === 'draw' && live !== null && (
        <span className="diagram-draft" aria-hidden="true" style={place(live)} />
      )}
    </div>
  )
}
