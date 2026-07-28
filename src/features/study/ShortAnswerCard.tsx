import { useId } from 'react'

interface ShortAnswerCardProps {
  readonly prompt: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly disabled: boolean
}

export const ShortAnswerCard = ({ prompt, value, onChange, disabled }: ShortAnswerCardProps) => {
  const inputId = useId()
  return (
    <div className="study-card">
      <p className="study-prompt">{prompt}</p>
      <div className="study-field">
        <label htmlFor={inputId}>Your answer</label>
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          autoComplete="off"
          autoFocus={!disabled}
        />
      </div>
    </div>
  )
}
