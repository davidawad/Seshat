import { useCallback, useRef, useState } from 'react'
import { NAV_OPTION_ATTRIBUTE, useOptionNavigation } from '../../lib/useOptionNavigation'
import type { ConfidenceRating } from '../../types'
import { CONFIDENCE_OPTIONS } from './useStudyShortcuts'

interface ConfidencePromptProps {
  readonly onSelect: (rating: ConfidenceRating) => void
}

/**
 * "How confident are you in that answer?" — three buttons with arrow-key
 * navigation, shared by Study and Learn. Asked before the learner sees whether
 * they were right (the optional Settings > confidence prompt).
 */
export const ConfidencePrompt = ({ onSelect }: ConfidencePromptProps) => {
  // Highlighted option for arrow-style navigation (see useOptionNavigation).
  const [index, setIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const confirm = useCallback(
    (at: number) => {
      const option = CONFIDENCE_OPTIONS[at]
      if (option !== undefined) onSelect(option.value)
    },
    [onSelect],
  )
  useOptionNavigation({
    count: CONFIDENCE_OPTIONS.length,
    index,
    onIndexChange: setIndex,
    onConfirm: confirm,
    orientation: 'horizontal',
    enabled: true,
    containerRef: ref,
  })
  return (
    <fieldset className="review-confidence">
      <legend>How confident are you in that answer?</legend>
      <div ref={ref} className="confidence-options">
        {CONFIDENCE_OPTIONS.map((option, at) => (
          <button
            key={option.value}
            type="button"
            autoFocus={at === 0}
            data-testid={option.testId}
            onClick={() => onSelect(option.value)}
            onFocus={() => setIndex(at)}
            {...{ [NAV_OPTION_ATTRIBUTE]: '' }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
