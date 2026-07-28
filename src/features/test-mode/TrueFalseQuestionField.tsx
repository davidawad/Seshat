import { useId } from 'react'
import type { TrueFalseQuestion } from './generate-test'

interface TrueFalseQuestionFieldProps {
  readonly question: TrueFalseQuestion
  readonly index: number
  readonly value: boolean | null
  readonly onChange: (value: boolean) => void
}

/** True/false question: shows the card's front plus a claimed back (real or borrowed), learner judges it. */
export const TrueFalseQuestionField = ({ question, index, value, onChange }: TrueFalseQuestionFieldProps) => {
  const groupName = useId()
  return (
    <fieldset className="card-content measure test-truefalse">
      <legend className="test-question-prompt">
        {index + 1}. {question.front}
      </legend>
      <p className="test-truefalse-claim">{question.claimedAnswer}</p>
      <div className="test-truefalse-options">
        <label>
          <input type="radio" name={groupName} checked={value === true} onChange={() => onChange(true)} />
          True
        </label>
        <label>
          <input type="radio" name={groupName} checked={value === false} onChange={() => onChange(false)} />
          False
        </label>
      </div>
    </fieldset>
  )
}
