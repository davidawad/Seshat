import { z } from 'zod'
import { summarizeMastery } from '../features/sets/set-summary'
import { parseImportParam } from '../features/sets/url-import'
import { type Result, type StudyCard, err, ok, setIdSchema } from '../types'
import { SETTING_KEYS, parseSettingsPatch } from './settings-patch'
import { MAX_BACKUP_CHARS, attachBackupMedia } from './backup'
import { loadMediaMap } from './media/export'
import type { MediaStore } from './media/store'
import { collectMediaRefs, mediaSummary } from './media/refs'
import type { useSeshatStore } from './store'

/**
 * WebMCP: in-page tools a browser-driving agent can call instead of
 * clicking. Written against the W3C Web Machine Learning CG draft
 * "WebMCP", Draft Community Group Report of 2 October 2026
 * (https://webmachinelearning.github.io/webmcp/, read 2026-10-03), which
 * differs from older blog posts/Chrome-flag builds:
 *   - the entry point is `document.modelContext` (a `partial interface
 *     Document`), not `navigator.modelContext`. We prefer it and fall back
 *     to `navigator.modelContext` for older flagged Chrome builds.
 *   - there is no `provideContext`/`unregisterTool`: a tool is registered
 *     with `registerTool(tool, { signal })` and unregistered by aborting
 *     that signal. Registering a duplicate name rejects (InvalidStateError).
 *   - `execute(input, { signal })` may resolve to any JSON-serializable
 *     value; we return the explainer's `{ content: [{ type: 'text', text }] }`
 *     shape (plus `isError`) so MCP-style agents read it either way.
 *   - `ToolAnnotations` is `{ readOnlyHint, untrustedContentHint,
 *     consequentialHint, debugging }`.
 * The spec's security section is unresolved, so every argument is treated
 * as untrusted: validated with Zod, size-capped, never thrown to the agent.
 *
 * Pure and React-free on purpose (the hook lives in `useWebMcp.ts`) so the
 * logic counts toward the coverage gate. Each tool's Zod schema is defined
 * once and yields both the JSON Schema advertised to agents and the
 * runtime validation.
 */

// ---------------------------------------------------------------------------
// Minimal local typing of the browser API (no polyfill dependency)
// ---------------------------------------------------------------------------

export interface WebMcpAnnotations {
  readonly readOnlyHint?: boolean
  readonly untrustedContentHint?: boolean
  readonly consequentialHint?: boolean
}

export interface WebMcpToolResult {
  readonly content: readonly { readonly type: 'text'; readonly text: string }[]
  readonly isError?: boolean
}

export interface ModelContextTool {
  readonly name: string
  readonly description: string
  readonly inputSchema: object
  readonly annotations: WebMcpAnnotations
  readonly execute: (input: unknown, options?: { readonly signal?: AbortSignal }) => Promise<WebMcpToolResult>
}

export interface ModelContextLike {
  readonly registerTool: (
    tool: ModelContextTool,
    options: { readonly signal: AbortSignal },
  ) => Promise<unknown> | unknown
}

/** Feature detection: the spec's `document.modelContext`, else the older `navigator.modelContext`. */
export const detectModelContext = (doc: Document = document, nav: Navigator = navigator): ModelContextLike | null => {
  const candidate: unknown = Reflect.get(doc, 'modelContext') ?? Reflect.get(nav, 'modelContext')
  return typeof candidate === 'object' &&
    candidate !== null &&
    typeof Reflect.get(candidate, 'registerTool') === 'function'
    ? (candidate as ModelContextLike)
    : null
}

// ---------------------------------------------------------------------------
// Dependencies the tools read at CALL time (never a stale closure)
// ---------------------------------------------------------------------------

type Store = ReturnType<typeof useSeshatStore>

export interface WebMcpDeps {
  readonly store: Pick<
    Store,
    'state' | 'importSet' | 'prepareSetImport' | 'exportSet' | 'updateSettings' | 'exportAll' | 'importAll'
  >
  /** The image store: export_set / export_all embed the images' bytes from here. */
  readonly media: MediaStore
  readonly navigate: (path: string) => void
  readonly now: () => Date
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const text = (value: unknown, isError = false): WebMcpToolResult => ({
  content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }],
  ...(isError ? { isError: true } : {}),
})

const failure = (message: string): WebMcpToolResult => text({ error: message }, true)

const jsonText = z.string().min(1).max(MAX_BACKUP_CHARS)

const NAV_TARGETS = { home: '/', sets: '/sets', stats: '/stats', docs: '/docs', about: '/about', set: '/sets' } as const
const navTargetSchema = z.enum(['home', 'sets', 'stats', 'docs', 'about', 'set'])

const noArgs = z.strictObject({})
const setArgs = z.strictObject({ setId: setIdSchema.describe('A set id, as returned by list_sets.') })
const settingsPatch = z
  .record(z.string(), z.unknown())
  .describe(`Settings to change, keyed by name. Known keys: ${SETTING_KEYS.join(', ')}.`)

// A call's outcome: a value to report, or an error message to hand back as a structured error.
type Outcome = Result<unknown, string>
// Tools that touch image storage are async; the rest return synchronously.
type MaybeAsyncOutcome = Outcome | Promise<Outcome>

interface ToolSpec<S extends z.ZodType> {
  readonly name: string
  readonly description: string
  readonly schema: S
  readonly annotations: WebMcpAnnotations
  readonly run: (args: z.output<S>, deps: WebMcpDeps, raw: unknown) => MaybeAsyncOutcome
}

const defineTool =
  <S extends z.ZodType>(spec: ToolSpec<S>) =>
  (getDeps: () => WebMcpDeps): ModelContextTool => ({
    name: spec.name,
    description: spec.description,
    // `input`: transforms/defaults describe what the agent SENDS, not what we parse it into.
    inputSchema: z.toJSONSchema(spec.schema, { io: 'input', unrepresentable: 'any' }),
    annotations: spec.annotations,
    execute: async (input) => {
      const parsed = spec.schema.safeParse(input ?? {})
      if (!parsed.success) {
        const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
        return failure(`Invalid arguments. ${issues.slice(0, 5).join('; ')}`)
      }
      try {
        const outcome = await spec.run(parsed.data, getDeps(), input)
        return outcome.ok ? text(outcome.value) : failure(outcome.error)
      } catch (error) {
        return failure(error instanceof Error ? error.message : 'Unexpected error.')
      }
    },
  })

const READ = { readOnlyHint: true, untrustedContentHint: true } as const

/**
 * Card content as list_cards shows it. Stored images (MediaRefs) are reduced
 * to {id, alt, width, height}; a LEGACY inline data URL (easily hundreds of
 * KB, present until the boot migration has run) is swapped for a short
 * descriptor, so an agent's context is never flooded. Everything else
 * (regions, labels, text) is kept. export_set and export_all are the explicit
 * way to get the full data.
 */
export const stripImageBytes = (content: StudyCard['content']) => {
  if (content.kind === 'short-answer') {
    return content.answerImage ? { ...content, answerImage: mediaSummary(content.answerImage) } : content
  }
  if (content.kind !== 'image-occlusion') return content
  const { imageDataUrl, image, ...rest } = content
  if (image) return { ...rest, image: mediaSummary(image) }
  if (imageDataUrl === undefined) return { ...rest, image: null }
  const mime = /^data:([^;,]+)/.exec(imageDataUrl)?.[1] ?? 'unknown'
  const base64 = imageDataUrl.slice(imageDataUrl.indexOf(',') + 1)
  return { ...rest, image: { hasImage: true, approxBytes: Math.floor((base64.length * 3) / 4), mime } }
}

export const TOOL_FACTORIES = [
  defineTool({
    name: 'list_sets',
    description: 'List all study sets with card counts and mastery (memorized, due for review, new).',
    schema: noArgs,
    annotations: READ,
    run: (_args, { store, now }) =>
      ok(
        store.state.sets.map((set) => {
          const cards = store.state.cards.filter((card) => card.setId === set.id)
          const { total, memorized, due, newCount } = summarizeMastery(cards, now())
          return {
            id: set.id,
            name: set.name,
            description: set.description,
            tags: set.tags,
            cardCount: total,
            memorized,
            due,
            new: newCount,
          }
        }),
      ),
  }),
  defineTool({
    name: 'list_cards',
    description:
      'List the cards in one study set (prompt, content, tags and review state). Images are never inlined: a stored image shows as {id, alt, width, height} (card promptImage, short-answer answerImage, image-occlusion content.image); a legacy not-yet-migrated data URL shows as image {hasImage, approxBytes, mime} (use export_set for the full data).',
    schema: setArgs,
    annotations: READ,
    run: ({ setId }, { store }) =>
      store.state.sets.some((set) => set.id === setId)
        ? ok(
            store.state.cards
              .filter((card) => card.setId === setId)
              .map(({ id, prompt, promptImage, content, explanation, tags, scheduling }) => ({
                id,
                prompt,
                promptImage: mediaSummary(promptImage),
                content: stripImageBytes(content),
                explanation,
                tags,
                state: scheduling.state,
                due: scheduling.due,
              })),
          )
        : err(`No set with id ${setId}.`),
  }),
  defineTool({
    name: 'get_settings',
    description: 'Read the current app settings (theme, typeface, retention target and so on).',
    schema: noArgs,
    annotations: { readOnlyHint: true },
    run: (_args, { store }) => ok(store.state.settings),
  }),
  defineTool({
    name: 'update_settings',
    description:
      'Change one or more app settings. Pass only the fields to change; unknown or out-of-range fields are rejected and nothing is applied.',
    schema: z.strictObject({ patch: settingsPatch }),
    annotations: {},
    run: ({ patch }, { store }) => {
      const changes = parseSettingsPatch(patch)
      if (!changes.ok) return changes
      if (Object.keys(changes.value).length === 0) return err('patch is empty; pass at least one setting.')
      store.updateSettings(changes.value)
      return ok({ applied: Object.keys(changes.value) })
    },
  }),
  defineTool({
    name: 'import_set',
    description:
      'Import one study set from a JSON string: either {"name": string, "terms": [{"term", "definition"}]} or a full Seshat set export (seshatExportVersion 1). Adds a new set; existing sets are untouched.',
    schema: z.strictObject({ json: jsonText.describe('The set JSON, as a string.') }),
    annotations: {},
    run: async ({ json }, { store }) => {
      const parsed = parseImportParam(json)
      if (parsed === null || !parsed.ok) return err(parsed === null ? 'Nothing to import.' : parsed.error)
      const prepared = await store.prepareSetImport(parsed.value)
      if (!prepared.ok) return err(prepared.error)
      const set = store.importSet(prepared.value)
      return ok({ id: set.id, name: set.name, cardCount: prepared.value.cards.length })
    },
  }),
  defineTool({
    name: 'export_set',
    description:
      'Export one study set as Seshat set-export JSON (no review history). Full data: images are embedded as base64 in a media map keyed by image id.',
    schema: setArgs,
    annotations: READ,
    run: async ({ setId }, { store, media }) => {
      const exported = store.exportSet(setId)
      if (exported === null) return err(`No set with id ${setId}.`)
      const { value } = await loadMediaMap(media, collectMediaRefs(exported.cards))
      return ok({ ...exported, media: value })
    },
  }),
  defineTool({
    name: 'export_all',
    description:
      'Export everything (settings, keybindings, all sets, cards and review history) as one backup object. Full data: images are embedded as base64 in a media map keyed by image id (can be very large).',
    schema: noArgs,
    annotations: READ,
    run: async (_args, { store, media }) => ok((await attachBackupMedia(store.exportAll(), media)).value),
  }),
  defineTool({
    name: 'import_all',
    description:
      'Restore a full backup (from export_all) given as a JSON string. mode "merge" (default) only adds sets/cards that are missing. mode "replace" DESTROYS all current data and settings — only use it when the user explicitly asked.',
    schema: z.strictObject({
      json: jsonText.describe('The backup JSON, as a string.'),
      mode: z.enum(['merge', 'replace']).default('merge'),
    }),
    annotations: { consequentialHint: true },
    run: async ({ json, mode }, { store }) => {
      const result = await store.importAll(json, mode)
      return result.ok ? ok(result.value) : err(result.error)
    },
  }),
  defineTool({
    name: 'navigate',
    description: 'Move the open tab to a page: home, sets, stats, docs, about, or "set" (needs setId, opens that set).',
    schema: z.strictObject({ to: navTargetSchema, setId: setIdSchema.optional() }),
    annotations: {},
    run: ({ to, setId }, { store, navigate }) => {
      if (to !== 'set') {
        navigate(NAV_TARGETS[to])
        return ok({ navigatedTo: NAV_TARGETS[to] })
      }
      if (setId === undefined) return err('setId is required when to is "set".')
      if (!store.state.sets.some((set) => set.id === setId)) return err(`No set with id ${setId}.`)
      navigate(`/sets/${setId}`)
      return ok({ navigatedTo: `/sets/${setId}` })
    },
  }),
] as const

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Registers every tool on `modelContext` and returns a cleanup that
 * unregisters them (aborts the shared signal — the spec's only unregister
 * path). Never throws: a missing/broken API or a rejected registration
 * (e.g. a duplicate name) is swallowed so WebMCP can never break the app.
 * `getDeps` is invoked per tool call, so handlers see current state.
 */
export const registerWebMcpTools = (modelContext: ModelContextLike | null, getDeps: () => WebMcpDeps): (() => void) => {
  if (modelContext === null) return () => undefined
  const controller = new AbortController()
  for (const makeTool of TOOL_FACTORIES) {
    try {
      Promise.resolve(modelContext.registerTool(makeTool(getDeps), { signal: controller.signal })).catch(
        () => undefined,
      )
    } catch {
      // Feature is best-effort; carry on with the remaining tools.
    }
  }
  return () => controller.abort()
}
