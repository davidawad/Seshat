import { Legible } from '../../components/Legible'
import type { TestQuestion } from './generate-test'
import { type TestAnswer, answerLabel, correctAnswerLabel, gradeAnswer } from './grade-test'

interface TestResultsProps {
  readonly questions: readonly TestQuestion[]
  readonly answers: readonly TestAnswer[]
  /** Omitted (no button shown) when nothing was missed. */
  readonly onRetryMissed?: () => void
}

/** Post-submit summary score plus a per-question review list (question, your answer, correct answer, right/wrong). */
export const TestResults = ({ questions, answers, onRetryMissed }: TestResultsProps) => {
  const graded = questions.map((question, index) => {
    const answer = answers[index]
    const correct = answer !== undefined && gradeAnswer(question, answer)
    return { question, answer, correct }
  })
  const correctCount = graded.filter((entry) => entry.correct).length
  const missedCount = questions.length - correctCount

  return (
    <div className="test-results">
      <p role="status" className="test-score">
        {correctCount} / {questions.length} correct
      </p>
      {missedCount > 0 && onRetryMissed !== undefined && (
        <button type="button" className="test-retry-missed" onClick={onRetryMissed} autoFocus>
          Retry {missedCount} missed question{missedCount === 1 ? '' : 's'}
        </button>
      )}
      <ol className="test-review-list">
        {graded.map(({ question, answer, correct }, index) => (
          <li
            key={question.cardId}
            className={
              correct
                ? 'test-review-item illuminated-panel is-correct'
                : 'test-review-item illuminated-panel is-incorrect'
            }
          >
            <p className={correct ? 'review-result is-correct' : 'review-result is-incorrect'}>
              {correct ? 'Correct' : 'Incorrect'}
            </p>
            <Legible>
              <p className="test-question-prompt">
                {index + 1}. {question.front}
              </p>
              <p className="test-your-answer">
                Your answer: {answer === undefined || answerLabel(answer) === '' ? '(blank)' : answerLabel(answer)}
              </p>
              <p className="review-correct-answer">Correct answer: {correctAnswerLabel(question)}</p>
            </Legible>
          </li>
        ))}
      </ol>
    </div>
  )
}
