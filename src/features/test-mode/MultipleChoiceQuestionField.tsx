import { useId } from 'react'
import { Legible } from '../../components/Legible'
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
  const promptId = useId()
  return (
    // A real <fieldset>/<legend> can't wrap the legend to a second line
    // without visibly breaking the fieldset's own border — question stems
    // here can run long, so this uses role="group" + aria-labelledby
    // instead, which wraps like ordinary text while keeping the identical
    // accessible name/group relationship a <legend> would give.
    <Legible as="div" className="test-mc" role="group" aria-labelledby={promptId}>
      <p id={promptId} className="test-question-prompt">
        {index + 1}. {question.front}
      </p>
      <div className="test-mc-options">
        {question.options.map((option) => (
          <label key={option}>
            <input type="radio" name={groupName} checked={value === option} onChange={() => onChange(option)} />
            {option}
          </label>
        ))}
      </div>
    </Legible>
  )
}
