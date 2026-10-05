import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'

/** Minimum horizontal drag, in px, before a pointer gesture counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD_PX = 60
/** Caps how far the card visually follows the finger, so a long drag doesn't fling it off-panel. */
const DRAG_VISUAL_CAP_PX = 80

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

type PointerHandler = (event: ReactPointerEvent<HTMLDivElement>) => void

/**
 * Swipe navigation, additive to tap/Space/grade buttons/keys. Follows the
 * pointer-capture + threshold-on-release pattern used by the occlusion-region
 * drag in DiagramEditor.tsx. A swipe commits a grade and advances —
 * left mirrors "still learning", right mirrors "know" — same as the
 * buttons/keys, just gestural. `resetKey` clears any gesture in progress when
 * a new card is shown.
 */
export const useCardSwipe = (onSwipeGrade: (known: boolean) => void, resetKey: string) => {
  const [dragX, setDragX] = useState(0)
  // The client X/Y the current gesture started at (null when none is in
  // progress), plus a flag so the synthetic click that follows a released drag
  // doesn't also flip/re-trigger the card.
  const swipeStartX = useRef<number | null>(null)
  const swipeStartY = useRef<number | null>(null)
  const justSwiped = useRef(false)

  useEffect(() => {
    setDragX(0)
    swipeStartX.current = null
    swipeStartY.current = null
  }, [resetKey])

  const onPointerDown: PointerHandler = (event) => {
    swipeStartX.current = event.clientX
    swipeStartY.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove: PointerHandler = (event) => {
    if (swipeStartX.current === null) return
    setDragX(clamp(event.clientX - swipeStartX.current, -DRAG_VISUAL_CAP_PX, DRAG_VISUAL_CAP_PX))
  }

  const endGesture: PointerHandler = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDragX(0)
  }

  const onPointerUp: PointerHandler = (event) => {
    const startX = swipeStartX.current
    const startY = swipeStartY.current
    swipeStartX.current = null
    swipeStartY.current = null
    endGesture(event)
    if (startX === null || startY === null) return

    const deltaX = event.clientX - startX
    const deltaY = event.clientY - startY
    // Ignore small movements (a tap) and mostly-vertical drags (scrolling).
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY)) return

    justSwiped.current = true
    onSwipeGrade(deltaX > 0)
  }

  const onPointerCancel: PointerHandler = (event) => {
    swipeStartX.current = null
    swipeStartY.current = null
    endGesture(event)
  }

  // A swipe that just released fires a synthetic click right after; swallow
  // exactly that one so a completed swipe doesn't also flip/grade a second
  // time via the click path. Returns true when the click was swallowed.
  const consumeSwipeClick = (): boolean => {
    if (!justSwiped.current) return false
    justSwiped.current = false
    return true
  }

  return { dragX, consumeSwipeClick, pointerHandlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } }
}
