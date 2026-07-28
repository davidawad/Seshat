import { describe, expect, it } from 'vitest'
import type { CardId } from '../../types'
import type { MultipleChoiceQuestion, TrueFalseQuestion, WrittenQuestion } from './generate-test'
import { type TestAnswer, answerLabel, correctAnswerLabel, emptyAnswer, gradeAnswer, isAnswered } from './grade-test'

const cardId = (n: number): CardId => `card-fixture-${n}` as CardId

const written: WrittenQuestion = {
  format: 'written',
  cardId: cardId(1),
  front: 'Powerhouse of the cell?',
  correctAnswer: 'Mitochondria',
}

const trueFalseTrue: TrueFalseQuestion = {
  format: 'true-false',
  cardId: cardId(2),
  front: 'Powerhouse of the cell?',
  claimedAnswer: 'Mitochondria',
  claimIsTrue: true,
}

const trueFalseFalse: TrueFalseQuestion = {
  format: 'true-false',
  cardId: cardId(3),
  front: 'Powerhouse of the cell?',
  claimedAnswer: 'Nucleus',
  claimIsTrue: false,
}

const mcq: MultipleChoiceQuestion = {
  format: 'multiple-choice',
  cardId: cardId(4),
  front: 'Powerhouse of the cell?',
  options: ['Nucleus', 'Mitochondria', 'Ribosome'],
  correctOption: 'Mitochondria',
}

describe('emptyAnswer / isAnswered', () => {
  it('seeds an empty answer matching the question format', () => {
    expect(emptyAnswer(written)).toEqual({ format: 'written', response: '' })
    expect(emptyAnswer(trueFalseTrue)).toEqual({ format: 'true-false', response: null })
    expect(emptyAnswer(mcq)).toEqual({ format: 'multiple-choice', response: null })
  })

  it('treats blank/null responses as unanswered', () => {
    expect(isAnswered({ format: 'written', response: '   ' })).toBe(false)
    expect(isAnswered({ format: 'written', response: 'x' })).toBe(true)
    expect(isAnswered({ format: 'true-false', response: null })).toBe(false)
    expect(isAnswered({ format: 'true-false', response: false })).toBe(true)
    expect(isAnswered({ format: 'multiple-choice', response: null })).toBe(false)
    expect(isAnswered({ format: 'multiple-choice', response: 'Nucleus' })).toBe(true)
  })
})

describe('gradeAnswer', () => {
  it('grades written answers via normalizeAnswer (case/whitespace/punctuation tolerant)', () => {
    expect(gradeAnswer(written, { format: 'written', response: '  mitochondria.  ' })).toBe(true)
    expect(gradeAnswer(written, { format: 'written', response: 'nucleus' })).toBe(false)
  })

  it('grades true/false against claimIsTrue', () => {
    expect(gradeAnswer(trueFalseTrue, { format: 'true-false', response: true })).toBe(true)
    expect(gradeAnswer(trueFalseTrue, { format: 'true-false', response: false })).toBe(false)
    expect(gradeAnswer(trueFalseFalse, { format: 'true-false', response: false })).toBe(true)
    expect(gradeAnswer(trueFalseFalse, { format: 'true-false', response: true })).toBe(false)
  })

  it('grades multiple-choice against correctOption', () => {
    expect(gradeAnswer(mcq, { format: 'multiple-choice', response: 'Mitochondria' })).toBe(true)
    expect(gradeAnswer(mcq, { format: 'multiple-choice', response: 'Nucleus' })).toBe(false)
  })

  it('a blank answer always grades incorrect', () => {
    expect(gradeAnswer(written, { format: 'written', response: '' })).toBe(false)
    expect(gradeAnswer(trueFalseTrue, { format: 'true-false', response: null })).toBe(false)
    expect(gradeAnswer(mcq, { format: 'multiple-choice', response: null })).toBe(false)
  })
})

describe('correctAnswerLabel / answerLabel', () => {
  it('renders the canonical correct answer per format', () => {
    expect(correctAnswerLabel(written)).toBe('Mitochondria')
    expect(correctAnswerLabel(trueFalseTrue)).toBe('True')
    expect(correctAnswerLabel(trueFalseFalse)).toBe('False')
    expect(correctAnswerLabel(mcq)).toBe('Mitochondria')
  })

  it('renders the learner-facing answer per format', () => {
    const writtenAnswer: TestAnswer = { format: 'written', response: 'nucleus' }
    const tfAnswer: TestAnswer = { format: 'true-false', response: true }
    const mcAnswer: TestAnswer = { format: 'multiple-choice', response: 'Ribosome' }
    expect(answerLabel(writtenAnswer)).toBe('nucleus')
    expect(answerLabel(tfAnswer)).toBe('True')
    expect(answerLabel(mcAnswer)).toBe('Ribosome')
    expect(answerLabel({ format: 'true-false', response: null })).toBe('')
    expect(answerLabel({ format: 'multiple-choice', response: null })).toBe('')
  })
})
