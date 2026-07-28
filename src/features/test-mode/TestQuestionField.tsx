import type { TestAnswer } from './grade-test'
import type { TestQuestion } from './generate-test'
import { MultipleChoiceQuestionField } from './MultipleChoiceQuestionField'
import { TrueFalseQuestionField } from './TrueFalseQuestionField'
import { WrittenQuestionField } from './WrittenQuestionField'

interface TestQuestionFieldProps {
  readonly question: TestQuestion
  readonly index: number
  readonly answer: TestAnswer
  readonly onChange: (answer: TestAnswer) => void
}

/** Dispatches to the format-specific question component, keeping `answer` in sync with `question.format`. */
export const TestQuestionField = ({ question, index, answer, onChange }: TestQuestionFieldProps) => {
  switch (question.format) {
    case 'written':
      return (
        <WrittenQuestionField
          question={question}
          index={index}
          value={answer.format === 'written' ? answer.response : ''}
          onChange={(response) => onChange({ format: 'written', response })}
        />
      )
    case 'true-false':
      return (
        <TrueFalseQuestionField
          question={question}
          index={index}
          value={answer.format === 'true-false' ? answer.response : null}
          onChange={(response) => onChange({ format: 'true-false', response })}
        />
      )
    case 'multiple-choice':
      return (
        <MultipleChoiceQuestionField
          question={question}
          index={index}
          value={answer.format === 'multiple-choice' ? answer.response : null}
          onChange={(response) => onChange({ format: 'multiple-choice', response })}
        />
      )
  }
}
