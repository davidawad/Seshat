import { z } from 'zod'
import { mediaMapSchema, mediaRefSchema } from './lib/media/types'

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
  // Optional image shown on the answer side (a MediaRef into the IndexedDB
  // media store). `.default(null)` so data saved before this existed parses.
  answerImage: mediaRefSchema.nullable().default(null),
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

export const imageOcclusionContentSchema = z
  .object({
    kind: z.literal('image-occlusion'),
    // LEGACY, read-only: a data: URL from before images moved to the media
    // store. The boot migration (lib/media/migrate.ts) and backup/set import
    // rewrite it to `image` and drop it; until that has happened (migration
    // failed, or the data came from an old file) it is still rendered.
    imageDataUrl: z.string().min(1).optional(),
    // The image as a MediaRef; its bytes live in IndexedDB, keyed by sha256.
    image: mediaRefSchema.nullable().default(null),
    occlusions: z.array(occlusionRegionSchema).min(1),
    // Diagram cards (one FSRS card per label): the id of the one region this
    // card asks about. Absent on older cards, which then quiz one random
    // region per review. A stale id (no such region) falls back the same way.
    askedRegionId: z.string().min(1).optional(),
    // Groups the sibling cards generated from one diagram, so editing the
    // diagram can add/update/remove the per-label cards together.
    diagramId: z.string().min(1).optional(),
  })
  // At least one image source must exist. (A refinement is not expressible in
  // JSON Schema; z.toJSONSchema ignores it, so the published schemas simply do
  // not state this rule — see the `hasOcclusionImage` note in agents.txt.)
  .refine((content) => content.image !== null || content.imageDataUrl !== undefined, {
    message: 'image-occlusion content needs an image (or a legacy imageDataUrl)',
    path: ['image'],
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
  // Optional image on the prompt side (a MediaRef). Additive: `.default(null)`.
  promptImage: mediaRefSchema.nullable().default(null),
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
  // The learner's own free-text answer to "why is this correct?" — see
  // research/learning-science/bisra-2018.md. Only ever populated when
  // Settings.selfExplanationEnabled is on; `.default(null)` so existing
  // localStorage from before this field existed still parses.
  selfExplanation: z.string().nullable().default(null),
})

export type ReviewLogEntry = z.infer<typeof reviewLogEntrySchema>

// ---------------------------------------------------------------------------
// Settings — typography/legibility choices and study defaults
// ---------------------------------------------------------------------------

export const typefaceSchema = z.enum(['atkinson-hyperlegible', 'verdana', 'inter', 'source-serif-4', 'georgia'])
export type Typeface = z.infer<typeof typefaceSchema>

export const themeSchema = z.enum(['light', 'dark', 'system'])
export type Theme = z.infer<typeof themeSchema>

// Named color palettes — pure data in features/settings/palettes.ts; 'archive'
// is the original gold/brown look and the default, so nothing changes unless
// someone picks another.
export const paletteSchema = z.enum(['archive', 'slate', 'sage', 'rose', 'high-contrast'])
export type Palette = z.infer<typeof paletteSchema>

// Optional custom accent, stored as lowercase #rrggbb. Contrast against the
// background is checked at input time and again when applied (see
// features/settings/palettes.ts), so a stale/hand-edited value can't make
// the UI unreadable.
export const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/)

export const retentionPresetSchema = z.enum(['low-workload', 'balanced', 'exam-prep', 'custom'])
export type RetentionPreset = z.infer<typeof retentionPresetSchema>

export const homeViewSchema = z.enum(['grid', 'table'])
export type HomeView = z.infer<typeof homeViewSchema>

export const cardSizeSchema = z.enum(['small', 'medium', 'large', 'xlarge', 'xxlarge', 'quizlet'])
export type CardSize = z.infer<typeof cardSizeSchema>

export const flashcardsFrontSchema = z.enum(['term', 'definition'])
export type FlashcardsFront = z.infer<typeof flashcardsFrontSchema>

export const settingsSchema = z.object({
  typeface: typefaceSchema,
  bodyFontSizePt: z.number().min(11.5).max(13),
  lineHeight: z.number().min(1.4).max(1.5),
  measureCh: z.number().min(55).max(75),
  theme: themeSchema,
  palette: paletteSchema.default('archive'),
  customAccent: hexColorSchema.nullable().default(null),
  reducedMotion: z.boolean(),
  retentionPreset: retentionPresetSchema,
  desiredRetention: z.number().min(0.7).max(0.98),
  // Opt-in "why is this correct?" prompt during reveal — see
  // research/learning-science/bisra-2018.md. Defaults off: it lengthens
  // every review, so it shouldn't be sprung on anyone who hasn't chosen it.
  selfExplanationEnabled: z.boolean().default(false),
  // Optional Study steps, both OFF by default (the lighter, Quizlet-Learn-like
  // flow: answer -> feedback -> Continue). This is the single place the
  // defaults live (DEFAULT_SETTINGS below mirrors them for typed construction).
  // Confidence on: ask Guessed/Unsure/Sure before the reveal and log it
  // (see research/learning-science/janssen-lazonder-2024.md). Off: no step,
  // `confidence: null` is logged. Self-rating on: learner picks
  // Again/Hard/Good/Easy; off: grade is derived from correctness.
  confidencePromptEnabled: z.boolean().default(false),
  selfRatingPromptEnabled: z.boolean().default(false),
  // Gates the whole Games section (Match + newer arcade-style modes) as one
  // experimental cohort — see features/games/. Defaults on so existing
  // Match users see no regression; the toggle exists for people who'd
  // rather keep the app to just the FSRS-graded modes.
  experimentalGamesEnabled: z.boolean().default(true),
  // Flashcards Options modal. Tracking off = grading only advances the card
  // (no FSRS/review-log change); `Front` picks which side shows first.
  // Defaults match the pre-option behavior so old saved data is unchanged.
  flashcardsTrackProgress: z.boolean().default(true),
  flashcardsFront: flashcardsFrontSchema.default('term'),
  // How big index cards render on the flashcards page and the set-page preview.
  flashcardsCardSize: cardSizeSchema.default('large'),
  // How the home page lists sets: cards (grid) or a compact table.
  homeView: homeViewSchema.default('grid'),
  // The "Install Seshat" PWA banner (components/InstallPrompt.tsx). Defaults
  // off — it's a fixed-position overlay that can sit on top of page content
  // (see index.css's `body.has-install-prompt` padding workaround), and not
  // everyone wants to be nagged to install a PWA. Off means the browser's
  // own native install affordance (if any) is left alone too — see
  // InstallPrompt.tsx for why disabling this doesn't call preventDefault.
  installPromptEnabled: z.boolean().default(false),
  // The "Press [key] ..." tip on flashcard faces. On by default; each tip also retires itself
  // once the learner has done what it teaches (see lib/tipDismissal.ts).
  cardTipsEnabled: z.boolean().default(true),
  // The dismissible "Your cards are saved on this device only. Download a backup" banner (see
  // lib/activation.ts for when it appears).
  backupRemindersEnabled: z.boolean().default(true),
  // Diagram (image-occlusion) study: off = only the asked label's region is
  // masked and the other regions stay visible; on = every region is masked.
  diagramHideAllLabels: z.boolean().default(false),
})

export type Settings = z.infer<typeof settingsSchema>

export const DEFAULT_SETTINGS: Settings = {
  typeface: 'atkinson-hyperlegible',
  bodyFontSizePt: 12.5,
  lineHeight: 1.45,
  measureCh: 65,
  theme: 'system',
  palette: 'archive',
  customAccent: null,
  reducedMotion: false,
  retentionPreset: 'balanced',
  desiredRetention: 0.9,
  selfExplanationEnabled: false,
  confidencePromptEnabled: false,
  selfRatingPromptEnabled: false,
  experimentalGamesEnabled: true,
  flashcardsTrackProgress: true,
  flashcardsFront: 'term',
  flashcardsCardSize: 'large',
  homeView: 'grid',
  installPromptEnabled: false,
  cardTipsEnabled: true,
  backupRemindersEnabled: true,
  diagramHideAllLabels: false,
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

/**
 * Version 2 keeps images out of the state: cards hold MediaRefs, the bytes
 * live in IndexedDB (lib/media). Version 1 (images inline as data URLs) is
 * still READ — by the boot migration and as a fallback when migration cannot
 * complete — see `legacyAppStateSchema` and lib/media/migrate.ts.
 */
export const APP_STATE_VERSION = 2
export const LEGACY_APP_STATE_VERSION = 1

// ---------------------------------------------------------------------------
// Activation — local-only first-week metrics and backup-reminder bookkeeping. Never sent anywhere
// (Seshat has no network telemetry); lives in the app state so it survives reloads on this device
// only, and is deliberately NOT part of the backup file. All logic is in lib/activation.ts.
// ---------------------------------------------------------------------------

export const firstSetSourceSchema = z.enum(['sample', 'import', 'create'])
export type FirstSetSource = z.infer<typeof firstSetSourceSchema>

export const activationSchema = z.object({
  /** When the first set was added (any source) and how. */
  firstSetAt: z.iso.datetime().nullable().default(null),
  firstSetSource: firstSetSourceSchema.nullable().default(null),
  /** When the first non-sample set was added: arms the backup reminder. */
  firstRealSetAt: z.iso.datetime().nullable().default(null),
  firstGradedAt: z.iso.datetime().nullable().default(null),
  /** Lifetime graded reviews (does not shrink when sets are deleted). */
  totalReviews: z.number().int().min(0).default(0),
  /** Distinct local calendar days with a review, and the latest such day (YYYY-MM-DD). */
  daysStudied: z.number().int().min(0).default(0),
  lastStudyDay: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  /** Reviewed on the 2nd / 7th calendar day after the first set was added (day 1 = the day it was added). */
  day2Return: z.boolean().default(false),
  day7Return: z.boolean().default(false),
  /** Backup reminder anchors: the latest backup download and the latest dismissal, each with the review count then. */
  lastBackupAt: z.iso.datetime().nullable().default(null),
  reviewsAtLastBackup: z.number().int().min(0).default(0),
  nudgeDismissedAt: z.iso.datetime().nullable().default(null),
  reviewsAtNudgeDismissal: z.number().int().min(0).default(0),
})

export type Activation = z.infer<typeof activationSchema>

export const createEmptyActivation = (): Activation => activationSchema.parse({})

const appStateFields = {
  sets: z.array(studySetSchema),
  cards: z.array(studyCardSchema),
  reviewLog: z.array(reviewLogEntrySchema),
  settings: settingsSchema,
  activation: activationSchema.default(createEmptyActivation),
}

export const appStateSchema = z.object({ version: z.literal(APP_STATE_VERSION), ...appStateFields })

/** The version-1 envelope. Same fields: the card schema is additive, so v1 cards (inline data URLs) parse unchanged. */
export const legacyAppStateSchema = z.object({ version: z.literal(LEGACY_APP_STATE_VERSION), ...appStateFields })

export type AppState = z.infer<typeof appStateSchema>

export const createEmptyAppState = (): AppState => ({
  version: APP_STATE_VERSION,
  sets: [],
  cards: [],
  reviewLog: [],
  settings: DEFAULT_SETTINGS,
  activation: createEmptyActivation(),
})

// ---------------------------------------------------------------------------
// Portable set export format — what import/export and set-sharing use.
// Deliberately excludes scheduling state: importing a set should not import
// someone else's memory model.
// ---------------------------------------------------------------------------

export const exportedCardSchema = z.object({
  prompt: z.string().min(1),
  promptImage: mediaRefSchema.nullable().default(null),
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
  // Bytes for every MediaRef the cards use (base64, keyed by media id). Absent in
  // text-only exports and in v1-era exports, whose images are inline data URLs.
  media: mediaMapSchema.optional(),
})

export type ExportedSet = z.infer<typeof exportedSetSchema>
