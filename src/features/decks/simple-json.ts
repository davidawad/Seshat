import { z } from 'zod'
import { type ExportedCard, type Result, type StudyCard, err, ok } from '../../types'
import { cardFrontBack } from '../study/card-summary'

/**
 * The portable "just term/definition pairs" JSON format — Quizlet's own
 * study-set shape, minus everything Seshat-specific (card kinds, FSRS
 * state, tags). Every card round-trips through this as a short-answer
 * card; richer kinds (cloze/mcq/image-occlusion) export via their
 * `cardFrontBack` front/back reduction and re-import as short-answer.
 *
 * Deliberately a looser, separate schema from `exportedDeckSchema` in
 * types.ts — this format's whole point is interop with plain JSON files
 * from other tools/scripts, not fidelity to Seshat's own card model.
 */

const termSchema = z.object({ term: z.string().min(1), definition: z.string().min(1) })

// Accepts common key aliases so a hand-written or third-party JSON file
// doesn't have to match "term"/"definition" exactly.
const rawTermSchema = z
  .object({
    term: z.string().optional(),
    definition: z.string().optional(),
    question: z.string().optional(),
    answer: z.string().optional(),
    front: z.string().optional(),
    back: z.string().optional(),
  })
  .transform((raw, ctx) => {
    const term = raw.term ?? raw.question ?? raw.front
    const definition = raw.definition ?? raw.answer ?? raw.back
    if (term === undefined || definition === undefined || term.trim() === '' || definition.trim() === '') {
      ctx.addIssue({
        code: 'custom',
        message: 'Each entry needs a term/definition pair (or question/answer, front/back).',
      })
      return z.NEVER
    }
    return { term: term.trim(), definition: definition.trim() }
  })

const bareArraySchema = z.array(rawTermSchema).min(1)
const wrappedSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  terms: z.array(rawTermSchema).min(1),
})

export interface SimpleJsonImportResult {
  /** `null` when the file was a bare array with no deck name to infer. */
  readonly name: string | null
  readonly cards: ExportedCard[]
}

const toExportedCards = (terms: readonly { readonly term: string; readonly definition: string }[]): ExportedCard[] =>
  terms.map((t) => ({
    prompt: t.term,
    content: { kind: 'short-answer', answer: t.definition, acceptableAnswers: [] },
    explanation: null,
    sourceRef: null,
    tags: [],
  }))

/** Parses a simple term/definition JSON file — either a bare array or `{name/title, terms}`. */
export const parseSimpleJson = (raw: string): Result<SimpleJsonImportResult, string> => {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch (error) {
    return err(`That file isn't valid JSON (${error instanceof Error ? error.message : 'parse error'}).`)
  }

  const wrapped = wrappedSchema.safeParse(parsedJson)
  if (wrapped.success) {
    return ok({ name: wrapped.data.name ?? wrapped.data.title ?? null, cards: toExportedCards(wrapped.data.terms) })
  }

  const bare = bareArraySchema.safeParse(parsedJson)
  if (bare.success) {
    return ok({ name: null, cards: toExportedCards(bare.data) })
  }

  return err(
    "That JSON doesn't look like a term/definition set. Expected an array of {term, definition} objects, or {name, terms: [...]}.",
  )
}

/** Serializes a deck's cards to the simple term/definition JSON format. */
export const toSimpleJson = (
  deckName: string,
  cards: readonly StudyCard[],
): { name: string; terms: readonly z.infer<typeof termSchema>[] } => ({
  name: deckName,
  terms: cards.map((card) => {
    const { front, back } = cardFrontBack(card)
    return { term: front, definition: back }
  }),
})
