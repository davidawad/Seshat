import { useCallback, useEffect, useRef, useState } from 'react'
import { TESTIDS } from '../../lib/testids'
import { OptionAnnouncer } from '../../lib/OptionAnnouncer'
import { NAV_OPTION_ATTRIBUTE, useOptionNavigation } from '../../lib/useOptionNavigation'
import { useNumberedShortcut } from '../../lib/useNumberedShortcut'
import type { McqContent } from '../../types'
import { OptionGrid } from './OptionGrid'
import { MathText } from '../../components/MathText'

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
    <p className="study-prompt">
      <MathText text={prompt} />
    </p>
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
  /** The learner picked option `index` (click or digit key): the answer is submitted at once. */
  readonly onPick: (index: number) => void
  readonly disabled: boolean
  /** Move focus onto the first option on mount (the learner just pressed "Show options"). */
  readonly focusFirst: boolean
}

/**
 * The OPTIONS half: a radio group laid out by `OptionGrid` (a row of four on desktop; two columns
 * of short options or one per row of long ones on a phone). Picking an option, by click, Enter or
 * Space on the focused option, or its digit key (`studyAnswer.mcqOption1-4`), submits it at once:
 * there is no select-then-Continue step. Arrow-style keys (the remappable `nav.*` set) only move
 * focus over the grid as it is actually drawn ('grid' orientation measures the live column count).
 * `value` is the submitted option, shown pressed (solid accent) once the step has moved on.
 */
export const McqOptions = ({ content, value, onPick, disabled, focusFirst }: McqOptionsProps) => {
  const optionsRef = useRef<HTMLDivElement>(null)
  const [highlight, setHighlight] = useState<number | null>(null)

  useEffect(() => {
    if (focusFirst) optionsRef.current?.querySelector<HTMLElement>(`[${NAV_OPTION_ATTRIBUTE}]`)?.focus()
  }, [focusFirst])

  const pick = useCallback(
    (index: number) => {
      if (!disabled) onPick(index)
    },
    [disabled, onPick],
  )

  useNumberedShortcut('studyAnswer.mcqOption', Math.min(content.options.length, MAX_SHORTCUT_OPTIONS), !disabled, pick)
  useOptionNavigation({
    count: content.options.length,
    index: highlight,
    onIndexChange: setHighlight,
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
            onClick={() => pick(index)}
            onFocus={() => setHighlight(index)}
            disabled={disabled}
            {...{ [NAV_OPTION_ATTRIBUTE]: '' }}
          >
            <MathText text={option} />
          </button>
        ))}
      </OptionGrid>
      <OptionAnnouncer index={highlight} labels={content.options} />
    </>
  )
}
