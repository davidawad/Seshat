import { useEffect } from 'react'
import { matchesBinding } from '../../lib/keybindings'
import { TESTIDS } from '../../lib/testids'
import { useKeybindings } from '../../lib/useKeybindings'
import type { ConfidenceRating, Grade } from '../../types'
import { GRADE_ORDER, type StudyStep } from './grading'

export const CONFIDENCE_OPTIONS: readonly {
  readonly value: ConfidenceRating
  readonly label: string
  readonly actionId: string
  readonly testId: string
}[] = [
  { value: 'guessed', label: 'Guessed', actionId: 'studyConfidence.guessed', testId: TESTIDS.studyConfidenceGuessed },
  { value: 'unsure', label: 'Unsure', actionId: 'studyConfidence.unsure', testId: TESTIDS.studyConfidenceUnsure },
  { value: 'sure', label: 'Sure', actionId: 'studyConfidence.sure', testId: TESTIDS.studyConfidenceSure },
]

const GRADE_ACTION_IDS: readonly string[] = [
  'studyReveal.again',
  'studyReveal.hard',
  'studyReveal.good',
  'studyReveal.easy',
]

interface StudyShortcutsOptions {
  readonly step: StudyStep
  /** Grade keys (1-4) only exist when the self-rating setting is on. */
  readonly selfRatingEnabled: boolean
  readonly onConfidence: (rating: ConfidenceRating) => void
  readonly onGrade: (grade: Grade) => void
  /** Present exactly while a Continue button is shown and enabled; the `studyContinue.next` key (Space) calls it. */
  readonly onContinue?: (() => void) | undefined
}

/** Controls that already act on Space (or take typed text) themselves: the shortcut must not double-fire. */
const handlesSpaceItself = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLButtonElement ||
    target instanceof HTMLAnchorElement ||
    target.isContentEditable ||
    target.getAttribute('role') === 'button' ||
    target.getAttribute('role') === 'radio')

/** `studyContinue.next` (Space by default) presses Continue while `onContinue` is defined. */
const useContinueShortcut = (onContinue: (() => void) | undefined): void => {
  const { key: keyFor } = useKeybindings()
  useEffect(() => {
    if (onContinue === undefined) return
    const handler = (event: KeyboardEvent) => {
      if (event.repeat || handlesSpaceItself(event.target)) return
      if (!matchesBinding(keyFor('studyContinue.next'), event)) return
      event.preventDefault()
      onContinue()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onContinue, keyFor])
}

/**
 * Remappable keyboard shortcuts for the visible Study steps (confidence, then
 * the self-rating grades, and Space for Continue) — skipped while a text input is focused so digits
 * keep typing into short-answer/cloze fields.
 */
export const useStudyShortcuts = ({
  step,
  selfRatingEnabled,
  onConfidence,
  onGrade,
  onContinue,
}: StudyShortcutsOptions) => {
  const { key: keyFor } = useKeybindings()
  useContinueShortcut(onContinue)
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (step === 'confidence') {
        const option = CONFIDENCE_OPTIONS.find((candidate) => matchesBinding(keyFor(candidate.actionId), event))
        if (option !== undefined) onConfidence(option.value)
      } else if (step === 'reveal' && selfRatingEnabled) {
        const index = GRADE_ACTION_IDS.findIndex((actionId) => matchesBinding(keyFor(actionId), event))
        const grade = index === -1 ? undefined : GRADE_ORDER[index]
        if (grade !== undefined) onGrade(grade)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [step, selfRatingEnabled, onConfidence, onGrade, keyFor])
}
