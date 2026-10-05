import { type RefObject, useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../../flashcards/grade-motion'

/*
 * Decorative Web Animations for Blast (transform/opacity only). Everything is
 * skipped for reduced motion, a hidden page, or where `animate` is missing
 * (jsdom), and nothing in the game ever waits on an animation: rounds advance
 * and outcomes commit on their own timers.
 */

type Motion = [Keyframe[], KeyframeAnimationOptions]

const hasMotion = (el: HTMLElement | null): el is HTMLElement =>
  el !== null && typeof el.animate === 'function' && !prefersReducedMotion()

const POP: Keyframe[] = [
  { opacity: 0, transform: 'translateY(10px) scale(0.8)' },
  { opacity: 1, transform: 'none' },
]

/** A counter that ticks: a quick scale up and back. */
export const BUMP: Motion = [
  [{ transform: 'scale(1)' }, { transform: 'scale(1.25)', offset: 0.4 }, { transform: 'scale(1)' }],
  { duration: 300, easing: 'ease-out' },
]

/** A wrong pick shakes side to side and dips in opacity (an error flash). */
export const SHAKE: Motion = [
  [
    { transform: 'translateX(0)', opacity: 1 },
    { transform: 'translateX(-6px)', opacity: 0.5, offset: 0.25 },
    { transform: 'translateX(6px)', opacity: 1, offset: 0.75 },
    { transform: 'translateX(0)', opacity: 1 },
  ],
  { duration: 400 },
]

/** The answered field holds a beat (so the result reads), then fades and slides away before the next round. */
export const LEAVE: Motion = [[...POP].reverse(), { duration: 250, delay: 650, fill: 'forwards' }]

/** Gentle idle drift for one asteroid; `index` offsets the phase so they do not bob in lockstep. */
export const BOB = (index: number): Motion => [
  [{ translate: '0 0' }, { translate: '0 -4px' }],
  { duration: 3200, delay: -index * 800, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' },
]

/** Staggered pop-in for the nth item of a freshly shown group. */
export const ENTER = (index: number): Motion => [POP, { duration: 350, delay: index * 70, fill: 'backwards' }]

/** Bumps `ref` whenever `value` changes after the first render. */
export const useBump = (ref: RefObject<HTMLElement | null>, value: number): void => {
  const previous = useRef(value)
  useEffect(() => {
    if (previous.current === value) return
    previous.current = value
    if (hasMotion(ref.current)) ref.current.animate(...BUMP)
  }, [ref, value])
}

/** Pops `ref`'s children (or `ref` itself with `self`) in, staggered, once on mount. */
export const useEnter = (ref: RefObject<HTMLElement | null>, self = false): void => {
  useEffect(() => {
    const el = ref.current
    if (!hasMotion(el)) return
    const targets = self ? [el] : [...el.children]
    targets.forEach((target, i) => target.animate(...ENTER(i)))
  }, [ref, self])
}

export type RockStatus = 'playing' | 'correct' | 'wrong' | 'timeout'

/**
 * Drives the live asteroid field: while playing, each asteroid bobs; once the
 * answer is in the bobbing stops, a wrong pick shakes, and the field fades out.
 */
export const useFieldMotion = (ref: RefObject<HTMLElement | null>, status: RockStatus): void => {
  useEffect(() => {
    const el = ref.current
    if (!hasMotion(el)) return
    if (status === 'playing') {
      const bobs = [...el.querySelectorAll('.blast-asteroid')].map((rock, i) => rock.animate(...BOB(i)))
      return () => bobs.forEach((bob) => bob.cancel())
    }
    el.querySelector('.is-shaken')?.animate(...SHAKE)
    el.animate(...LEAVE)
    return undefined
  }, [ref, status])
}

/** Wrapper state for one asteroid: live, blasted (picked, right) or shaken (picked, wrong). */
export const rockClassName = (status: RockStatus, isPicked: boolean, isCorrect: boolean): string => {
  if (status === 'playing' || !isPicked) return 'blast-rock'
  return isCorrect ? 'blast-rock is-blasted' : 'blast-rock is-shaken'
}

/** Value for `data-motion` (which gates the CSS-only effects): 'on' unless reduced motion or a hidden page. */
export const motionAttr = (): 'on' | undefined => (prefersReducedMotion() ? undefined : 'on')
