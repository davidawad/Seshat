import { useRef, useState } from 'react'
import { OptionAnnouncer } from '../../lib/OptionAnnouncer'
import { NAV_OPTION_ATTRIBUTE, useOptionNavigation } from '../../lib/useOptionNavigation'
import { useNumberedShortcut } from '../../lib/useNumberedShortcut'
import type { McqContent } from '../../types'

interface McqCardProps {
  readonly prompt: string
  readonly content: McqContent
  readonly value: number | null
  readonly onChange: (index: number) => void
  readonly disabled: boolean
}

/** How many leading options get a digit-key shortcut — see `studyAnswer.mcqOption1-4` in lib/keybindings.ts. */
const MAX_SHORTCUT_OPTIONS = 4

/**
 * MCQ cards follow the "prompt first, options after a beat" pattern from the
 * research brief: the prompt renders alone, and options only appear once the
 * learner explicitly asks for them (rather than being shown all at once,
 * which invites recognition instead of recall).
 */
export const McqCard = ({ prompt, content, value, onChange, disabled }: McqCardProps) => {
  const [revealed, setRevealed] = useState(value !== null)

  // Arrow-style keys (the remappable `nav.*` set) move the SAME selection the
  // digit keys and clicks set; Enter on an option submits the surrounding
  // form once that option is already the selected one.
  const optionsRef = useRef<HTMLDivElement>(null)

  // Digit keys also move real focus to the chosen option, so a following
  // Enter acts on the option that is actually selected.
  useNumberedShortcut(
    'studyAnswer.mcqOption',
    Math.min(content.options.length, MAX_SHORTCUT_OPTIONS),
    revealed && !disabled,
    (index) => {
      onChange(index)
      optionsRef.current?.querySelectorAll<HTMLElement>(`[${NAV_OPTION_ATTRIBUTE}]`)[index]?.focus()
    },
  )
  useOptionNavigation({
    count: content.options.length,
    index: value,
    onIndexChange: onChange,
    orientation: 'vertical',
    enabled: revealed && !disabled,
    containerRef: optionsRef,
  })

  return (
    <div className="study-card">
      <p className="study-prompt">{prompt}</p>
      {!revealed ? (
        <button type="button" onClick={() => setRevealed(true)} disabled={disabled} autoFocus={!disabled}>
          Show options
        </button>
      ) : (
        <div ref={optionsRef} role="radiogroup" aria-label="Answer options" className="study-mcq-options">
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
        </div>
      )}
      <OptionAnnouncer index={value} labels={content.options} />
    </div>
  )
}
