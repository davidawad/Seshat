import { useEffect, useRef } from 'react'
import { TESTIDS } from '../../lib/testids'
import { OptionAnnouncer } from '../../lib/OptionAnnouncer'
import { NAV_OPTION_ATTRIBUTE, useOptionNavigation } from '../../lib/useOptionNavigation'
import { useNumberedShortcut } from '../../lib/useNumberedShortcut'
import type { McqContent } from '../../types'
import { OptionGrid } from './OptionGrid'

/** How many leading options get a digit-key shortcut — see `studyAnswer.mcqOption1-4` in lib/keybindings.ts. */
const MAX_SHORTCUT_OPTIONS = 4

interface McqCardProps {
  readonly prompt: string
  /** False only when Settings.mcqShowOptionsOnRequest is on and the learner has not asked yet. */
  readonly optionsShown: boolean
  readonly onShowOptions: () => void
  readonly disabled: boolean
}

/**
 * The CARD half of a multiple-choice question: the prompt, plus — only when the "show options on
 * request" setting is on and the options are still hidden — the button that asks for them. The
 * options themselves are `McqOptions`, rendered outside the card.
 */
export const McqCard = ({ prompt, optionsShown, onShowOptions, disabled }: McqCardProps) => (
  <div className="study-card">
    <p className="study-prompt">{prompt}</p>
    {!optionsShown && (
      <button
        type="button"
        data-testid={TESTIDS.studyShowOptions}
        onClick={onShowOptions}
        disabled={disabled}
        autoFocus={!disabled}
      >
        Show options
      </button>
    )}
  </div>
)

interface McqOptionsProps {
  readonly content: McqContent
  readonly value: number | null
  readonly onChange: (index: number) => void
  readonly disabled: boolean
  /** Move focus onto the first option on mount (the learner just pressed "Show options"). */
  readonly focusFirst: boolean
}

/**
 * The OPTIONS half: a radio group laid out by `OptionGrid` (a row of four on desktop; two columns
 * of short options or one per row of long ones on a phone). Arrow-style keys (the remappable
 * `nav.*` set) move the SAME selection the digit keys and clicks set, over the grid as it is
 * actually drawn ('grid' orientation measures the live column count); Enter on an option submits
 * the surrounding form once that option is already the selected one.
 */
export const McqOptions = ({ content, value, onChange, disabled, focusFirst }: McqOptionsProps) => {
  const optionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focusFirst) optionsRef.current?.querySelector<HTMLElement>(`[${NAV_OPTION_ATTRIBUTE}]`)?.focus()
  }, [focusFirst])

  // Digit keys also move real focus to the chosen option, so a following
  // Enter acts on the option that is actually selected.
  useNumberedShortcut(
    'studyAnswer.mcqOption',
    Math.min(content.options.length, MAX_SHORTCUT_OPTIONS),
    !disabled,
    (index) => {
      onChange(index)
      optionsRef.current?.querySelectorAll<HTMLElement>(`[${NAV_OPTION_ATTRIBUTE}]`)[index]?.focus()
    },
  )
  useOptionNavigation({
    count: content.options.length,
    index: value,
    onIndexChange: onChange,
    orientation: 'grid',
    enabled: !disabled,
    containerRef: optionsRef,
  })

  return (
    <>
      <OptionGrid
        labels={content.options}
        containerRef={optionsRef}
        role="radiogroup"
        ariaLabel="Answer options"
        testId={TESTIDS.studyMcqOptions}
      >
        {content.options.map((option, index) => (
          <button
            key={`${index}-${option}`}
            type="button"
            role="radio"
            aria-checked={value === index}
            className={value === index ? 'study-mcq-option is-selected' : 'study-mcq-option'}
            onClick={() => onChange(index)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.repeat || value !== index) return
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }}
            disabled={disabled}
            {...{ [NAV_OPTION_ATTRIBUTE]: '' }}
          >
            {option}
          </button>
        ))}
      </OptionGrid>
      <OptionAnnouncer index={value} labels={content.options} />
    </>
  )
}
