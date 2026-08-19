import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CardId } from '../../types'
import type { MultipleChoiceQuestion, TestQuestion, TrueFalseQuestion, WrittenQuestion } from './generate-test'
import type { TestAnswer } from './grade-test'
import { TestResults } from './TestResults'

// @testing-library/react's auto-cleanup needs a global `afterEach`, which
// this project doesn't enable (no `test.globals: true` in vite.config.ts) —
// without this, DOM from one test leaks into the next.
afterEach(() => cleanup())

const writtenQ: WrittenQuestion = {
  format: 'written',
  cardId: 'card-1' as CardId,
  front: 'Capital of France',
  correctAnswer: 'Paris',
}

const trueFalseQ: TrueFalseQuestion = {
  format: 'true-false',
  cardId: 'card-2' as CardId,
  front: 'Capital of Italy',
  claimedAnswer: 'Rome',
  claimIsTrue: true,
}

const mcqQ: MultipleChoiceQuestion = {
  format: 'multiple-choice',
  cardId: 'card-3' as CardId,
  front: '2 + 2',
  options: ['3', '4', '5'],
  correctOption: '4',
}

describe('TestResults', () => {
  it('shows the overall score and marks each question Correct/Incorrect', () => {
    const questions: TestQuestion[] = [writtenQ, trueFalseQ, mcqQ]
    const answers: TestAnswer[] = [
      { format: 'written', response: 'Paris' },
      { format: 'true-false', response: true },
      { format: 'multiple-choice', response: '3' },
    ]

    render(<TestResults questions={questions} answers={answers} />)

    expect(screen.getByText('2 / 3 correct')).toBeInTheDocument()
    expect(screen.getAllByText('Correct')).toHaveLength(2)
    expect(screen.getAllByText('Incorrect')).toHaveLength(1)
    expect(screen.getByText('Your answer: Paris')).toBeInTheDocument()
    expect(screen.getByText('Correct answer: Paris')).toBeInTheDocument()
    expect(screen.getByText('Your answer: True')).toBeInTheDocument()
    expect(screen.getByText('Correct answer: True')).toBeInTheDocument()
    expect(screen.getByText('Your answer: 3')).toBeInTheDocument()
    expect(screen.getByText('Correct answer: 4')).toBeInTheDocument()
  })

  it('shows "(blank)" and grades it incorrect for an unanswered question', () => {
    const questions: TestQuestion[] = [writtenQ]
    const answers: TestAnswer[] = [{ format: 'written', response: '' }]

    render(<TestResults questions={questions} answers={answers} />)

    expect(screen.getByText('0 / 1 correct')).toBeInTheDocument()
    expect(screen.getByText('Incorrect')).toBeInTheDocument()
    expect(screen.getByText('Your answer: (blank)')).toBeInTheDocument()
  })

  it('does not render a retry button when nothing was missed, even if onRetryMissed is provided', () => {
    const questions: TestQuestion[] = [writtenQ]
    const answers: TestAnswer[] = [{ format: 'written', response: 'Paris' }]
    const onRetryMissed = vi.fn()

    render(<TestResults questions={questions} answers={answers} onRetryMissed={onRetryMissed} />)

    expect(screen.getByText('1 / 1 correct')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument()
  })

  it('does not render a retry button when onRetryMissed is omitted, even if something was missed', () => {
    const questions: TestQuestion[] = [writtenQ]
    const answers: TestAnswer[] = [{ format: 'written', response: 'wrong' }]

    render(<TestResults questions={questions} answers={answers} />)

    expect(screen.getByText('0 / 1 correct')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument()
  })

  it('renders a pluralized retry button with the missed count and invokes onRetryMissed when clicked', async () => {
    const user = userEvent.setup()
    const questions: TestQuestion[] = [writtenQ, trueFalseQ]
    const answers: TestAnswer[] = [
      { format: 'written', response: 'wrong' },
      { format: 'true-false', response: false },
    ]
    const onRetryMissed = vi.fn()

    render(<TestResults questions={questions} answers={answers} onRetryMissed={onRetryMissed} />)

    const retryButton = screen.getByRole('button', { name: 'Retry 2 missed questions' })
    expect(retryButton).toBeInTheDocument()

    await user.click(retryButton)
    expect(onRetryMissed).toHaveBeenCalledTimes(1)
  })

  it('uses singular phrasing when exactly one question was missed', () => {
    const questions: TestQuestion[] = [writtenQ, trueFalseQ]
    const answers: TestAnswer[] = [
      { format: 'written', response: 'Paris' },
      { format: 'true-false', response: false },
    ]

    render(<TestResults questions={questions} answers={answers} onRetryMissed={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Retry 1 missed question' })).toBeInTheDocument()
  })
})
