import { type FormEvent, useRef, useState } from 'react'
import { useSeshatStore } from '../../lib/store'
import type { StudyCard } from '../../types'
import { type TestQuestion, generateTest } from './generate-test'
import { type TestAnswer, emptyAnswer, gradeAnswer } from './grade-test'
import { TestQuestionField } from './TestQuestionField'
import { TestResults } from './TestResults'
import './test-mode.css'

interface TestSessionProps {
  readonly cards: readonly StudyCard[]
}

/**
 * Runs one generated test end to end: all questions on one page, a single
 * "Submit test" button, then results. Unlike the recall-first default study
 * mode, nothing is graded or revealed per-question — that's the point of a
 * "test" as opposed to a review loop.
 *
 * Submission policy: blanks are allowed through (like turning in a paper
 * test with a question left blank) rather than disabling Submit until every
 * question is answered — an unanswered question is simply graded wrong.
 *
 * Timing: this is a single-page test with no natural per-question boundary
 * (no "next" click to timestamp), so the whole test's elapsed time is split
 * evenly across its questions for each `recordReview` call rather than
 * over-engineering per-question timing.
 */
export const TestSession = ({ cards }: TestSessionProps) => {
  const { recordReview } = useSeshatStore()
  const [questions] = useState<TestQuestion[]>(() => generateTest(cards))
  const [answers, setAnswers] = useState<TestAnswer[]>(() => questions.map(emptyAnswer))
  const [submitted, setSubmitted] = useState(false)
  const startedAt = useRef(performance.now())

  const setAnswer = (index: number, answer: TestAnswer) => {
    setAnswers((previous) => previous.map((existing, i) => (i === index ? answer : existing)))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (submitted || questions.length === 0) return

    const totalElapsedMs = performance.now() - startedAt.current
    const perQuestionMs = totalElapsedMs / questions.length

    questions.forEach((question, index) => {
      const answer = answers[index]
      if (answer === undefined) return
      const correct = gradeAnswer(question, answer)
      recordReview(question.cardId, correct ? 'good' : 'again', null, correct, perQuestionMs)
    })

    setSubmitted(true)
  }

  if (questions.length === 0) {
    return <p>This deck doesn&rsquo;t have enough cards to generate a test.</p>
  }

  if (submitted) {
    return <TestResults questions={questions} answers={answers} />
  }

  return (
    <form className="test-session" onSubmit={handleSubmit}>
      <ol className="test-question-list">
        {questions.map((question, index) => (
          <li key={question.cardId} className="illuminated-panel test-question-item">
            <TestQuestionField
              question={question}
              index={index}
              answer={answers[index] ?? emptyAnswer(question)}
              onChange={(answer) => setAnswer(index, answer)}
            />
          </li>
        ))}
      </ol>
      <button type="submit">Submit test</button>
    </form>
  )
}
