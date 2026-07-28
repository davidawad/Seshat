import { useId } from 'react'
import type { MultipleChoiceQuestion } from './generate-test'

interface MultipleChoiceQuestionFieldProps {
  readonly question: MultipleChoiceQuestion
  readonly index: number
  readonly value: string | null
  readonly onChange: (value: string) => void
}

/** Multiple-choice question: shows the card's front plus shuffled options, learner picks one. */
export const MultipleChoiceQuestionField = ({ question, index, value, onChange }: MultipleChoiceQuestionFieldProps) => {
  const groupName = useId()
  return (
    <fieldset className="card-content measure test-mc">
      <legend className="test-question-prompt">
        {index + 1}. {question.front}
      </legend>
      <div className="test-mc-options">
        {question.options.map((option) => (
          <label key={option}>
            <input type="radio" name={groupName} checked={value === option} onChange={() => onChange(option)} />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
