import { z } from 'zod'

/**
 * Single source of truth: every persisted or imported shape is defined as a
 * Zod schema first, and the TypeScript type is inferred from it. Nothing
 * that crosses the storage or import/export boundary is trusted without
 * being parsed through one of these schemas first.
 */

// ---------------------------------------------------------------------------
// Branded IDs
// ---------------------------------------------------------------------------

// Named SetId (not the type Set, which would shadow JS's built-in Set<T>).
export const setIdSchema = z.uuid().brand('SetId')
export const cardIdSchema = z.uuid().brand('CardId')

export type SetId = z.infer<typeof setIdSchema>
export type CardId = z.infer<typeof cardIdSchema>

// ---------------------------------------------------------------------------
// Result — errors as values, not exceptions, for fallible operations
// ---------------------------------------------------------------------------

export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error })

// ---------------------------------------------------------------------------
// Card content — one card, one retrieval format, encoded as a discriminated
// union so an illegal combination (e.g. MCQ options on a cloze card) cannot
// be represented.
// ---------------------------------------------------------------------------

export const shortAnswerContentSchema = z.object({
  kind: z.literal('short-answer'),
  answer: z.string().min(1),
  acceptableAnswers: z.array(z.string().min(1)),
})

export const clozeContentSchema = z.object({
  kind: z.literal('cloze'),
  // Deletions are written as {{answer}} inside `text`.
  text: z.string().min(1),
})

export const mcqContentSchema = z.object({
  kind: z.literal('mcq'),
  options: z.array(z.string().min(1)).min(2),
  correctIndex: z.number().int().min(0),
})

// A single labeled rectangle over the image, expressed as percentages of the
// image's own width/height so it survives any display size. `label` is what
// the learner must recall for that region.
export const occlusionRegionSchema = z.object({
  id: z.string().min(1),
  xPct: z.number().min(0).max(100),
  yPct: z.number().min(0).max(100),
  widthPct: z.number().min(0).max(100),
  heightPct: z.number().min(0).max(100),
  label: z.string().min(1),
})

export type OcclusionRegion = z.infer<typeof occlusionRegionSchema>

export const imageOcclusionContentSchema = z.object({
  kind: z.literal('image-occlusion'),
  // A data: URL. Kept small deliberately — localStorage has no separate
  // blob store, so the image itself is downscaled/compressed client-side
  // before it ever reaches this field. See lib/storage.ts size guidance.
  imageDataUrl: z.string().min(1),
  occlusions: z.array(occlusionRegionSchema).min(1),
})

export type ImageOcclusionContent = z.infer<typeof imageOcclusionContentSchema>

export const cardContentSchema = z.discriminatedUnion('kind', [
  shortAnswerContentSchema,
  clozeContentSchema,
  mcqContentSchema,
  imageOcclusionContentSchema,
])

export type ShortAnswerContent = z.infer<typeof shortAnswerContentSchema>
export type ClozeContent = z.infer<typeof clozeContentSchema>
export type McqContent = z.infer<typeof mcqContentSchema>
export type CardContent = z.infer<typeof cardContentSchema>

// ---------------------------------------------------------------------------
// FSRS scheduling state — a serializable mirror of ts-fsrs's `Card`.
// Conversion to/from the ts-fsrs runtime shape lives in lib/fsrs.ts.
// ---------------------------------------------------------------------------

export const fsrsStateSchema = z.enum(['New', 'Learning', 'Review', 'Relearning'])
export type FsrsState = z.infer<typeof fsrsStateSchema>

export const schedulingStateSchema = z.object({
  due: z.iso.datetime(),
  stability: z.number().min(0),
  difficulty: z.number().min(0),
  scheduledDays: z.number().min(0),
  learningSteps: z.number().int().min(0),
  reps: z.number().int().min(0),
  lapses: z.number().int().min(0),
  state: fsrsStateSchema,
  lastReview: z.iso.datetime().nullable(),
})

export type SchedulingState = z.infer<typeof schedulingStateSchema>

// ---------------------------------------------------------------------------
// Study card
// ---------------------------------------------------------------------------

export const studyCardSchema = z.object({
  id: cardIdSchema,
  setId: setIdSchema,
  prompt: z.string().min(1),
  content: cardContentSchema,
  explanation: z.string().nullable(),
  sourceRef: z.string().nullable(),
  tags: z.array(z.string().min(1)),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  scheduling: schedulingStateSchema,
})

export type StudyCard = z.infer<typeof studyCardSchema>

// ---------------------------------------------------------------------------
// Study set — the core abstraction: a named collection of cards. (Called
// "deck" in most spaced-repetition tools, "set" here to match the vocabulary
// of the tool this app is a research-backed alternative to.)
// ---------------------------------------------------------------------------

export const studySetSchema = z.object({
  id: setIdSchema,
  name: z.string().min(1),
  description: z.string(),
  tags: z.array(z.string().min(1)),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  // Optional exam/review date (YYYY-MM-DD). When set, scheduling tightens
  // as the date approaches so nothing is left to first-review after it —
  // see lib/fsrs.ts `capToGoalDate` and research/learning-science/cepeda-2008.md
  // for why the spacing goal should shape retention target, not just interval.
  goalDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
})

export type StudySet = z.infer<typeof studySetSchema>

// ---------------------------------------------------------------------------
// Review log — one entry per answered card, the raw material for the
// calibration dashboard (confidence vs. actual correctness).
// ---------------------------------------------------------------------------

export const gradeSchema = z.enum(['again', 'hard', 'good', 'easy'])
export type Grade = z.infer<typeof gradeSchema>

export const confidenceRatingSchema = z.enum(['guessed', 'unsure', 'sure'])
export type ConfidenceRating = z.infer<typeof confidenceRatingSchema>

export const reviewLogEntrySchema = z.object({
  cardId: cardIdSchema,
  setId: setIdSchema,
  reviewedAt: z.iso.datetime(),
  grade: gradeSchema,
  confidence: confidenceRatingSchema.nullable(),
  correct: z.boolean(),
  retrievabilityAtReview: z.number().min(0).max(1).nullable(),
  elapsedMs: z.number().min(0),
})

export type ReviewLogEntry = z.infer<typeof reviewLogEntrySchema>

// ---------------------------------------------------------------------------
// Settings — typography/legibility choices and study defaults
// ---------------------------------------------------------------------------

export const typefaceSchema = z.enum(['atkinson-hyperlegible', 'verdana', 'inter', 'source-serif-4', 'georgia'])
export type Typeface = z.infer<typeof typefaceSchema>

export const themeSchema = z.enum(['light', 'dark', 'system'])
export type Theme = z.infer<typeof themeSchema>

export const retentionPresetSchema = z.enum(['low-workload', 'balanced', 'exam-prep', 'custom'])
export type RetentionPreset = z.infer<typeof retentionPresetSchema>

export const settingsSchema = z.object({
  typeface: typefaceSchema,
  bodyFontSizePt: z.number().min(11.5).max(13),
  lineHeight: z.number().min(1.4).max(1.5),
  measureCh: z.number().min(55).max(75),
  theme: themeSchema,
  reducedMotion: z.boolean(),
  retentionPreset: retentionPresetSchema,
  desiredRetention: z.number().min(0.7).max(0.98),
})

export type Settings = z.infer<typeof settingsSchema>

export const DEFAULT_SETTINGS: Settings = {
  typeface: 'atkinson-hyperlegible',
  bodyFontSizePt: 12.5,
  lineHeight: 1.45,
  measureCh: 65,
  theme: 'system',
  reducedMotion: false,
  retentionPreset: 'balanced',
  desiredRetention: 0.9,
}

// Anki/FSRS-guidance-derived presets — see research/learning-science for citations.
export const RETENTION_PRESETS: Record<Exclude<RetentionPreset, 'custom'>, number> = {
  'low-workload': 0.85,
  balanced: 0.9,
  'exam-prep': 0.93,
}

// ---------------------------------------------------------------------------
// Top-level persisted state
// ---------------------------------------------------------------------------

export const APP_STATE_VERSION = 1

export const appStateSchema = z.object({
  version: z.literal(APP_STATE_VERSION),
  sets: z.array(studySetSchema),
  cards: z.array(studyCardSchema),
  reviewLog: z.array(reviewLogEntrySchema),
  settings: settingsSchema,
})

export type AppState = z.infer<typeof appStateSchema>

export const createEmptyAppState = (): AppState => ({
  version: APP_STATE_VERSION,
  sets: [],
  cards: [],
  reviewLog: [],
  settings: DEFAULT_SETTINGS,
})

// ---------------------------------------------------------------------------
// Portable set export format — what import/export and set-sharing use.
// Deliberately excludes scheduling state: importing a set should not import
// someone else's memory model.
// ---------------------------------------------------------------------------

export const exportedCardSchema = z.object({
  prompt: z.string().min(1),
  content: cardContentSchema,
  explanation: z.string().nullable(),
  sourceRef: z.string().nullable(),
  tags: z.array(z.string().min(1)),
})

export type ExportedCard = z.infer<typeof exportedCardSchema>

export const exportedSetSchema = z.object({
  seshatExportVersion: z.literal(1),
  name: z.string().min(1),
  description: z.string(),
  tags: z.array(z.string().min(1)),
  cards: z.array(exportedCardSchema),
})

export type ExportedSet = z.infer<typeof exportedSetSchema>
