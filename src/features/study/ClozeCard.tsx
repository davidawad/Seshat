import { useId } from 'react'
import type { ClozeContent } from '../../types'
import { parseCloze } from './cloze'

interface ClozeCardProps {
  readonly prompt: string
  readonly content: ClozeContent
  readonly value: string
  readonly onChange: (value: string) => void
  readonly disabled: boolean
}

export const ClozeCard = ({ prompt, content, value, onChange, disabled }: ClozeCardProps) => {
  const inputId = useId()
  const parsed = parseCloze(content.text)

  return (
    <div className="study-card">
      {prompt.trim() !== '' && <p className="study-prompt">{prompt}</p>}
      {parsed === null ? (
        <p className="study-cloze-text">{content.text}</p>
      ) : (
        <p className="study-cloze-text">
          {parsed.before}
          <label className="study-cloze-label" htmlFor={inputId}>
            <span className="sr-only">Missing word</span>
            <input
              id={inputId}
              type="text"
              className="study-cloze-input"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              disabled={disabled}
              autoComplete="off"
              autoFocus={!disabled}
              size={Math.max(parsed.answer.length, 6)}
            />
          </label>
          {parsed.after}
        </p>
      )}
    </div>
  )
}
