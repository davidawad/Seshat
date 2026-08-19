import { useId } from 'react'
import { Legible } from '../../components/Legible'
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
  const promptId = useId()
  return (
    // See MultipleChoiceQuestionField.tsx for why this is role="group" +
    // aria-labelledby rather than a real <fieldset>/<legend>.
    <Legible as="div" className="test-truefalse" role="group" aria-labelledby={promptId}>
      <p id={promptId} className="test-question-prompt">
        {index + 1}. {question.front}
      </p>
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
    </Legible>
  )
}
