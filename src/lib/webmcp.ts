import { z } from 'zod'
import { summarizeMastery } from '../features/sets/set-summary'
import { parseImportParam } from '../features/sets/url-import'
import { type Result, type Settings, err, ok, setIdSchema, settingsSchema } from '../types'
import { MAX_BACKUP_CHARS } from './backup'
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
  readonly store: Pick<Store, 'state' | 'importSet' | 'exportSet' | 'updateSettings' | 'exportAll' | 'importAll'>
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
const settingsPatch = settingsSchema.partial().strict()

// A call's outcome: a value to report, or an error message to hand back as a structured error.
type Outcome = Result<unknown, string>

interface ToolSpec<S extends z.ZodType> {
  readonly name: string
  readonly description: string
  readonly schema: S
  readonly annotations: WebMcpAnnotations
  readonly run: (args: z.output<S>, deps: WebMcpDeps, raw: unknown) => Outcome
}

const defineTool =
  <S extends z.ZodType>(spec: ToolSpec<S>) =>
  (getDeps: () => WebMcpDeps): ModelContextTool => ({
    name: spec.name,
    description: spec.description,
    // `input`: transforms/defaults describe what the agent SENDS, not what we parse it into.
    inputSchema: z.toJSONSchema(spec.schema, { io: 'input', unrepresentable: 'any' }),
    annotations: spec.annotations,
    execute: (input) => {
      const parsed = spec.schema.safeParse(input ?? {})
      if (!parsed.success) {
        const issues = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
        return Promise.resolve(failure(`Invalid arguments. ${issues.slice(0, 5).join('; ')}`))
      }
      try {
        const outcome = spec.run(parsed.data, getDeps(), input)
        return Promise.resolve(outcome.ok ? text(outcome.value) : failure(outcome.error))
      } catch (error) {
        return Promise.resolve(failure(error instanceof Error ? error.message : 'Unexpected error.'))
      }
    },
  })

/**
 * `settingsSchema.partial()` still fills `.default()` fields for keys the
 * agent never sent, which would silently reset them. Keep only the keys that
 * were actually in the request (`raw` is `{ patch }`, already validated).
 */
const sentKeysOnly = (patch: object, raw: unknown): Partial<Settings> => {
  const sent = new Set(Object.keys(z.object({ patch: z.record(z.string(), z.unknown()) }).parse(raw).patch))
  return Object.fromEntries(
    Object.entries(patch).filter(([key, value]) => sent.has(key) && value !== undefined),
  ) as Partial<Settings>
}

const READ = { readOnlyHint: true, untrustedContentHint: true } as const

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
    description: 'List the cards in one study set (prompt, content, tags and review state).',
    schema: setArgs,
    annotations: READ,
    run: ({ setId }, { store }) =>
      store.state.sets.some((set) => set.id === setId)
        ? ok(
            store.state.cards
              .filter((card) => card.setId === setId)
              .map(({ id, prompt, content, explanation, tags, scheduling }) => ({
                id,
                prompt,
                content,
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
    run: ({ patch }, { store }, raw) => {
      const changes = sentKeysOnly(patch, raw)
      if (Object.keys(changes).length === 0) return err('patch is empty; pass at least one setting.')
      store.updateSettings(changes)
      return ok({ applied: Object.keys(changes) })
    },
  }),
  defineTool({
    name: 'import_set',
    description:
      'Import one study set from a JSON string: either {"name": string, "terms": [{"term", "definition"}]} or a full Seshat set export (seshatExportVersion 1). Adds a new set; existing sets are untouched.',
    schema: z.strictObject({ json: jsonText.describe('The set JSON, as a string.') }),
    annotations: {},
    run: ({ json }, { store }) => {
      const parsed = parseImportParam(json)
      if (parsed === null || !parsed.ok) return err(parsed === null ? 'Nothing to import.' : parsed.error)
      const set = store.importSet(parsed.value)
      return ok({ id: set.id, name: set.name, cardCount: parsed.value.cards.length })
    },
  }),
  defineTool({
    name: 'export_set',
    description: 'Export one study set as Seshat set-export JSON (no review history).',
    schema: setArgs,
    annotations: READ,
    run: ({ setId }, { store }) => {
      const exported = store.exportSet(setId)
      return exported === null ? err(`No set with id ${setId}.`) : ok(exported)
    },
  }),
  defineTool({
    name: 'export_all',
    description: 'Export everything (settings, keybindings, all sets, cards and review history) as one backup object.',
    schema: noArgs,
    annotations: READ,
    run: (_args, { store }) => ok(store.exportAll()),
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
    run: ({ json, mode }, { store }) => {
      const result = store.importAll(json, mode)
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
