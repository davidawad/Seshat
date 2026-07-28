import { useState } from 'react'
import type { McqContent } from '../../types'

interface McqCardProps {
  readonly prompt: string
  readonly content: McqContent
  readonly value: number | null
  readonly onChange: (index: number) => void
  readonly disabled: boolean
}

/**
 * MCQ cards follow the "prompt first, options after a beat" pattern from the
 * research brief: the prompt renders alone, and options only appear once the
 * learner explicitly asks for them (rather than being shown all at once,
 * which invites recognition instead of recall).
 */
export const McqCard = ({ prompt, content, value, onChange, disabled }: McqCardProps) => {
  const [revealed, setRevealed] = useState(value !== null)

  return (
    <div className="study-card">
      <p className="study-prompt">{prompt}</p>
      {!revealed ? (
        <button type="button" onClick={() => setRevealed(true)} disabled={disabled} autoFocus={!disabled}>
          Show options
        </button>
      ) : (
        <div role="radiogroup" aria-label="Answer options" className="study-mcq-options">
          {content.options.map((option, index) => (
            <button
              key={`${index}-${option}`}
              type="button"
              role="radio"
              aria-checked={value === index}
              className={value === index ? 'study-mcq-option is-selected' : 'study-mcq-option'}
              onClick={() => onChange(index)}
              disabled={disabled}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
