import { useId } from 'react'
import { Legible } from '../../components/Legible'
import type { WrittenQuestion } from './generate-test'

interface WrittenQuestionFieldProps {
  readonly question: WrittenQuestion
  readonly index: number
  readonly value: string
  readonly onChange: (value: string) => void
}

/** Written-recall question: shows the card's front, learner types the back. */
export const WrittenQuestionField = ({ question, index, value, onChange }: WrittenQuestionFieldProps) => {
  const inputId = useId()
  return (
    <Legible>
      <p className="test-question-prompt">
        {index + 1}. {question.front}
      </p>
      <label htmlFor={inputId}>Your answer</label>
      <input
        id={inputId}
        type="text"
        value={value}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
    </Legible>
  )
}
