/** Which way a graded card leaves: toward the Know (right) or Still learning (left) side. */
export type Leaving = 'know' | 'learning'

/** How long the card takes to slide off, and how long it holds first so the badge and border read. */
export const GRADE_EXIT_MS = 320
export const GRADE_EXIT_DELAY_MS = 90
/** Grace after the animation's nominal end before the grade is committed regardless (see `FlashcardSession`). */
export const GRADE_FALLBACK_SLACK_MS = 120
const SLIDE_PX = 140
const TILT_DEG = 7

/**
 * Arguments for `Element.animate` that carry a graded card off to its side:
 * a short hold (the colored border and badge appear via CSS), then a slide,
 * tilt and fade. `fill: 'forwards'` keeps it gone until the next card
 * replaces it, so there is no one-frame flash back at center.
 */
export const GRADE_EXIT = (known: boolean): [Keyframe[], KeyframeAnimationOptions] => {
  const sign = known ? 1 : -1
  return [
    [
      { transform: 'translateX(0) rotate(0deg)', opacity: 1 },
      { transform: `translateX(${sign * SLIDE_PX}px) rotate(${sign * TILT_DEG}deg)`, opacity: 0 },
    ],
    { duration: GRADE_EXIT_MS, delay: GRADE_EXIT_DELAY_MS, easing: 'cubic-bezier(0.4, 0, 0.8, 0.6)', fill: 'forwards' },
  ]
}

/**
 * True when the exit animation should be skipped: the learner asked for
 * reduced motion (the in-app setting or the OS preference), or the page is
 * hidden — browsers stop producing animation frames for a background tab, so
 * nobody would see it and an agent driving that tab would wait on frames that
 * never come.
 */
export const prefersReducedMotion = (): boolean =>
  document.hidden ||
  document.documentElement.dataset['reducedMotion'] === 'true' ||
  (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
