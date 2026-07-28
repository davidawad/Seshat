import type { CardContent, Grade, ImageOcclusionContent, OcclusionRegion } from '../../types'
import { clozeAnswer } from './cloze'

/** Canonical order of the FSRS self-rating grades, also used for the 1-4 keyboard shortcuts. */
export const GRADE_ORDER: readonly Grade[] = ['again', 'hard', 'good', 'easy']

/**
 * Pure grading logic, decoupled from React. One `Attempt` variant per
 * `CardContent` kind — every function below exhaustively switches on
 * `content.kind` (or `attempt.kind`) and deliberately has no `default`
 * branch, so an unhandled card kind is a TypeScript build error, not a
 * silent runtime bug.
 */

export type Attempt =
  | { readonly kind: 'short-answer'; readonly response: string }
  | { readonly kind: 'cloze'; readonly response: string }
  | { readonly kind: 'mcq'; readonly selectedIndex: number | null }
  | { readonly kind: 'image-occlusion'; readonly targetRegionId: string; readonly response: string }

/**
 * An image-occlusion card can have several regions; a single review only
 * quizzes one of them, matching the "one clear question per card" pattern
 * every other kind follows. Picked at random each time the card comes up,
 * so a multi-region card exercises all of its regions across repeated
 * reviews instead of always asking about the same one.
 */
export const pickOcclusionRegion = (content: ImageOcclusionContent): OcclusionRegion => {
  const index = Math.floor(Math.random() * content.occlusions.length)
  // `occlusions` is schema-guaranteed non-empty (`.min(1)`) and `index` is
  // always in range, so this indexed access always resolves.
  return content.occlusions[index]!
}

/** The empty attempt to seed a fresh review with, matching the card's content kind. */
export const initialAttempt = (content: CardContent): Attempt => {
  switch (content.kind) {
    case 'short-answer':
      return { kind: 'short-answer', response: '' }
    case 'cloze':
      return { kind: 'cloze', response: '' }
    case 'mcq':
      return { kind: 'mcq', selectedIndex: null }
    case 'image-occlusion':
      return { kind: 'image-occlusion', targetRegionId: pickOcclusionRegion(content).id, response: '' }
  }
}

/**
 * Normalizes free-text answers for comparison: trim, lowercase, collapse
 * internal whitespace, and strip trailing punctuation.
 */
export const normalizeAnswer = (input: string): string =>
  input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:'"]+$/, '')

/** Whether the attempt has enough content to be submitted for grading. */
export const isAttemptComplete = (content: CardContent, attempt: Attempt): boolean => {
  switch (content.kind) {
    case 'short-answer':
      return attempt.kind === 'short-answer' && attempt.response.trim() !== ''
    case 'cloze':
      return attempt.kind === 'cloze' && attempt.response.trim() !== ''
    case 'mcq':
      return attempt.kind === 'mcq' && attempt.selectedIndex !== null
    case 'image-occlusion':
      return attempt.kind === 'image-occlusion' && attempt.response.trim() !== ''
  }
}

/** Grades a completed attempt against the card's content. */
export const isCorrect = (content: CardContent, attempt: Attempt): boolean => {
  switch (content.kind) {
    case 'short-answer': {
      if (attempt.kind !== 'short-answer') return false
      const normalized = normalizeAnswer(attempt.response)
      return [content.answer, ...content.acceptableAnswers].some(
        (candidate) => normalizeAnswer(candidate) === normalized,
      )
    }
    case 'cloze': {
      if (attempt.kind !== 'cloze') return false
      const answer = clozeAnswer(content.text)
      return answer !== null && normalizeAnswer(attempt.response) === normalizeAnswer(answer)
    }
    case 'mcq': {
      if (attempt.kind !== 'mcq' || attempt.selectedIndex === null) return false
      return attempt.selectedIndex === content.correctIndex
    }
    case 'image-occlusion': {
      if (attempt.kind !== 'image-occlusion') return false
      const target = content.occlusions.find((region) => region.id === attempt.targetRegionId)
      if (target === undefined) return false
      return normalizeAnswer(attempt.response) === normalizeAnswer(target.label)
    }
  }
}

/**
 * The canonical correct-answer text, for display during reveal. Every other
 * kind has a single fixed answer; image-occlusion has one per region, so
 * this also takes the `attempt` to know which region was actually tested.
 */
export const correctAnswerLabel = (content: CardContent, attempt: Attempt): string => {
  switch (content.kind) {
    case 'short-answer':
      return content.answer
    case 'cloze':
      return clozeAnswer(content.text) ?? ''
    case 'mcq':
      return content.options[content.correctIndex] ?? ''
    case 'image-occlusion': {
      if (attempt.kind !== 'image-occlusion') return ''
      return content.occlusions.find((region) => region.id === attempt.targetRegionId)?.label ?? ''
    }
  }
}

/** What the learner actually answered, for display during reveal. */
export const attemptLabel = (content: CardContent, attempt: Attempt): string => {
  switch (content.kind) {
    case 'short-answer':
      return attempt.kind === 'short-answer' ? attempt.response : ''
    case 'cloze':
      return attempt.kind === 'cloze' ? attempt.response : ''
    case 'mcq':
      return attempt.kind === 'mcq' && attempt.selectedIndex !== null
        ? (content.options[attempt.selectedIndex] ?? '')
        : ''
    case 'image-occlusion':
      return attempt.kind === 'image-occlusion' ? attempt.response : ''
  }
}
