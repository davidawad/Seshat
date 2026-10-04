import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import {
  GRADE_EXIT,
  GRADE_EXIT_DELAY_MS,
  GRADE_EXIT_MS,
  GRADE_FALLBACK_SLACK_MS,
  type Leaving,
  prefersReducedMotion,
} from './grade-motion'

/**
 * Grades a card, playing the exit animation first when the browser can
 * animate and the learner has not asked for reduced motion: the card gets a
 * colored border and a Know / Still learning badge (via `leaving`), then
 * slides off toward that side. The grade is committed when the animation
 * finishes so the outcome and the next card land exactly when the motion ends
 * (or, at the latest, shortly after its nominal end). A second grade while one
 * is leaving is ignored, and an unmounted session (undo, restart) never
 * commits.
 */
export const useGradeMotion = (faceRef: RefObject<HTMLElement | null>, commitGrade: (known: boolean) => void) => {
  // Which way the card is currently leaving, while the grade animation runs.
  const [leaving, setLeaving] = useState<Leaving | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const handleGrade = useCallback(
    (known: boolean) => {
      if (leaving !== null) return
      const face = faceRef.current
      if (face === null || typeof face.animate !== 'function' || prefersReducedMotion()) {
        commitGrade(known)
        return
      }
      setLeaving(known ? 'know' : 'learning')
      const animation = face.animate(...GRADE_EXIT(known))
      let committed = false
      const commit = () => {
        if (committed || !mounted.current) return
        committed = true
        commitGrade(known)
      }
      animation.finished.then(commit, () => undefined)
      // Belt and braces: if frames stop (tab hidden mid-animation, throttled
      // renderer) `finished` may never settle, and a grade must not hang on it.
      window.setTimeout(commit, GRADE_EXIT_DELAY_MS + GRADE_EXIT_MS + GRADE_FALLBACK_SLACK_MS)
    },
    [commitGrade, faceRef, leaving],
  )

  return { leaving, handleGrade }
}
