import { normalizeAnswer } from '../study/grading'
import type { TestQuestion } from './generate-test'

/**
 * Pure grading logic for Test mode, decoupled from React — mirrors the shape
 * of `features/study/grading.ts`'s `Attempt`/`isCorrect` pair, but for
 * `TestQuestion`'s three formats instead of `CardContent`'s four kinds.
 */
export type TestAnswer =
  | { readonly format: 'written'; readonly response: string }
  | { readonly format: 'true-false'; readonly response: boolean | null }
  | { readonly format: 'multiple-choice'; readonly response: string | null }

/** The empty answer to seed a fresh question with, matching its format. */
export const emptyAnswer = (question: TestQuestion): TestAnswer => {
  switch (question.format) {
    case 'written':
      return { format: 'written', response: '' }
    case 'true-false':
      return { format: 'true-false', response: null }
    case 'multiple-choice':
      return { format: 'multiple-choice', response: null }
  }
}

/** Whether the learner has put down an answer at all (blank counts as unanswered, not wrong-in-advance). */
export const isAnswered = (answer: TestAnswer): boolean => {
  switch (answer.format) {
    case 'written':
      return answer.response.trim() !== ''
    case 'true-false':
      return answer.response !== null
    case 'multiple-choice':
      return answer.response !== null
  }
}

/** Grades one answered question. An unanswered (blank) response always grades as incorrect. */
export const gradeAnswer = (question: TestQuestion, answer: TestAnswer): boolean => {
  switch (question.format) {
    case 'written':
      return answer.format === 'written' && normalizeAnswer(answer.response) === normalizeAnswer(question.correctAnswer)
    case 'true-false':
      return answer.format === 'true-false' && answer.response === question.claimIsTrue
    case 'multiple-choice':
      return answer.format === 'multiple-choice' && answer.response === question.correctOption
  }
}

/** The canonical correct-answer text, for display in the post-submit review list. */
export const correctAnswerLabel = (question: TestQuestion): string => {
  switch (question.format) {
    case 'written':
      return question.correctAnswer
    case 'true-false':
      return question.claimIsTrue ? 'True' : 'False'
    case 'multiple-choice':
      return question.correctOption
  }
}

/** What the learner actually answered, for display in the post-submit review list. */
export const answerLabel = (answer: TestAnswer): string => {
  switch (answer.format) {
    case 'written':
      return answer.response
    case 'true-false':
      return answer.response === null ? '' : answer.response ? 'True' : 'False'
    case 'multiple-choice':
      return answer.response ?? ''
  }
}
