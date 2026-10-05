import { createMemoryMediaStore } from './media/store'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, createEmptyAppState } from '../types'
import {
  TOOL_FACTORIES,
  type ModelContextTool,
  type WebMcpDeps,
  detectModelContext,
  registerWebMcpTools,
} from './webmcp'

const SET_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ID = '22222222-2222-4222-8222-222222222222'

const makeDeps = (overrides: Partial<WebMcpDeps['store']> = {}): WebMcpDeps => ({
  store: {
    state: createEmptyAppState(),
    importSet: vi.fn(),
    prepareSetImport: vi.fn(async (exported: unknown) => ({ ok: true as const, value: exported })),
    exportSet: vi.fn(() => null),
    updateSettings: vi.fn(),
    exportAll: vi.fn(),
    importAll: vi.fn(),
    ...overrides,
  } as WebMcpDeps['store'],
  media: createMemoryMediaStore(),
  navigate: vi.fn(),
  now: () => new Date('2026-10-03T00:00:00Z'),
})

const tools = (getDeps: () => WebMcpDeps): Record<string, ModelContextTool> =>
  Object.fromEntries(TOOL_FACTORIES.map((make) => make(getDeps)).map((tool) => [tool.name, tool]))

const call = async (tool: ModelContextTool | undefined, input: unknown) => {
  const result = await tool?.execute(input)
  const body: unknown = JSON.parse(result?.content[0]?.text ?? 'null')
  return { isError: result?.isError === true, body }
}

const fakeContext = () => {
  const registered = new Map<string, { tool: ModelContextTool; signal: AbortSignal }>()
  return {
    registered,
    registerTool: (tool: ModelContextTool, { signal }: { signal: AbortSignal }) => {
      if (registered.has(tool.name)) return Promise.reject(new Error('InvalidStateError'))
      registered.set(tool.name, { tool, signal })
      signal.addEventListener('abort', () => registered.delete(tool.name))
      return Promise.resolve()
    },
  }
}

describe('detectModelContext', () => {
  it('is null when absent or malformed', () => {
    expect(detectModelContext({} as Document, {} as Navigator)).toBeNull()
    expect(detectModelContext({ modelContext: {} } as unknown as Document, {} as Navigator)).toBeNull()
  })

  it('prefers document over navigator, falls back to navigator', () => {
    const docContext = fakeContext()
    const doc = { modelContext: docContext } as unknown as Document
    const nav = { modelContext: fakeContext() } as unknown as Navigator
    expect(detectModelContext(doc, nav)).toBe(docContext)
    expect(detectModelContext({} as Document, nav)).not.toBeNull()
  })
})

describe('registerWebMcpTools', () => {
  it('does nothing without an API', () => {
    expect(() => registerWebMcpTools(null, makeDeps)()).not.toThrow()
  })

  it('registers every tool with JSON Schema and unregisters on cleanup', () => {
    const context = fakeContext()
    const cleanup = registerWebMcpTools(context, makeDeps)
    expect([...context.registered.keys()].sort()).toEqual([
      'export_all',
      'export_set',
      'get_settings',
      'import_all',
      'import_set',
      'list_cards',
      'list_sets',
      'navigate',
      'update_settings',
    ])
    for (const { tool } of context.registered.values()) {
      expect(tool.inputSchema).toMatchObject({ type: 'object' })
    }
    expect(context.registered.get('list_sets')?.tool.annotations.readOnlyHint).toBe(true)
    expect(context.registered.get('import_all')?.tool.annotations.consequentialHint).toBe(true)
    cleanup()
    expect(context.registered.size).toBe(0)
  })

  it('survives double-mount (register, cleanup, register) without duplicates', () => {
    const context = fakeContext()
    registerWebMcpTools(context, makeDeps)()
    registerWebMcpTools(context, makeDeps)
    expect(context.registered.size).toBe(TOOL_FACTORIES.length)
  })

  it('swallows throwing and rejecting registrations', () => {
    const throwing = {
      registerTool: () => {
        throw new Error('boom')
      },
    }
    const rejecting = { registerTool: () => Promise.reject(new Error('dup')) }
    expect(() => registerWebMcpTools(throwing, makeDeps)()).not.toThrow()
    expect(() => registerWebMcpTools(rejecting, makeDeps)()).not.toThrow()
  })
})

describe('tools', () => {
  it('reads fresh state on every call', async () => {
    let deps = makeDeps()
    const t = tools(() => deps)
    expect((await call(t['list_sets'], {})).body).toEqual([])
    const set = {
      id: SET_ID,
      name: 'A',
      description: '',
      tags: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      goalDate: null,
    }
    deps = makeDeps({ state: { ...createEmptyAppState(), sets: [set] } as never })
    expect((await call(t['list_sets'], {})).body).toMatchObject([
      { id: SET_ID, name: 'A', cardCount: 0, new: 0, due: 0, memorized: 0 },
    ])
    expect((await call(t['list_cards'], { setId: SET_ID })).body).toEqual([])
    expect((await call(t['list_cards'], { setId: OTHER_ID })).isError).toBe(true)
  })

  it('returns structured errors for bad arguments', async () => {
    const t = tools(makeDeps)
    expect((await call(t['list_cards'], { setId: 'nope' })).isError).toBe(true)
    expect((await call(t['list_sets'], { extra: 1 })).isError).toBe(true)
    expect((await call(t['import_set'], { json: '' })).isError).toBe(true)
    expect((await call(t['import_all'], { json: '{}', mode: 'wipe' })).isError).toBe(true)
    expect((await call(t['navigate'], { to: 'nowhere' })).isError).toBe(true)
    expect((await call(t['list_sets'], undefined)).isError).toBe(false)
  })

  it('converts a throwing handler into an error result', async () => {
    const t = tools(() =>
      makeDeps({
        exportAll: () => {
          throw new Error('disk')
        },
      }),
    )
    expect(await call(t['export_all'], {})).toEqual({ isError: true, body: { error: 'disk' } })
    const nonError = tools(() =>
      makeDeps({
        exportAll: () => {
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw 'x'
        },
      }),
    )
    expect((await call(nonError['export_all'], {})).isError).toBe(true)
  })

  it('get_settings and update_settings (strict)', async () => {
    const deps = makeDeps()
    const t = tools(() => deps)
    expect((await call(t['get_settings'], {})).body).toEqual(DEFAULT_SETTINGS)
    expect(await call(t['update_settings'], { patch: { theme: 'dark' } })).toEqual({
      isError: false,
      body: { applied: ['theme'] },
    })
    expect(deps.store.updateSettings).toHaveBeenCalledWith({ theme: 'dark' })
    for (const patch of [{ bogus: 1 }, { theme: 'neon' }, { desiredRetention: 5 }, {}]) {
      expect((await call(t['update_settings'], { patch })).isError).toBe(true)
    }
    expect(deps.store.updateSettings).toHaveBeenCalledTimes(1)
  })

  it('update_settings applies only the keys sent (no defaults injected)', async () => {
    const deps = makeDeps()
    const t = tools(() => deps)
    await call(t['update_settings'], { patch: { theme: 'light' } })
    expect(deps.store.updateSettings).toHaveBeenCalledWith({ theme: 'light' })
    const sent = vi.mocked(deps.store.updateSettings).mock.calls[0]?.[0] as Record<string, unknown>
    for (const key of ['palette', 'customAccent', 'flashcardsTrackProgress', 'flashcardsFront']) {
      expect(sent).not.toHaveProperty(key)
    }
  })

  it('import_set accepts simple and full shapes, rejects the rest', async () => {
    const importSet = vi.fn(() => ({ id: SET_ID, name: 'S' }))
    const t = tools(() => makeDeps({ importSet } as never))
    const simple = JSON.stringify({ name: 'S', terms: [{ term: 'q', definition: 'a' }] })
    expect(await call(t['import_set'], { json: simple })).toEqual({
      isError: false,
      body: { id: SET_ID, name: 'S', cardCount: 1 },
    })
    const full = JSON.stringify({ seshatExportVersion: 1, name: 'S', description: '', tags: [], cards: [] })
    expect((await call(t['import_set'], { json: full })).isError).toBe(false)
    expect((await call(t['import_set'], { json: '{"nope":1}' })).isError).toBe(true)
    expect((await call(t['import_set'], { json: 'not json' })).isError).toBe(true)
    expect(importSet).toHaveBeenCalledTimes(2)
  })

  it('export_set / export_all', async () => {
    const t = tools(() => makeDeps({ exportAll: () => ({ format: 'seshat-backup', cards: [] }) as never }))
    expect((await call(t['export_set'], { setId: SET_ID })).isError).toBe(true)
    expect((await call(t['export_all'], {})).body).toEqual({ format: 'seshat-backup', cards: [], media: {} })
    const found = tools(() => makeDeps({ exportSet: () => ({ name: 'x', cards: [] }) as never }))
    expect((await call(found['export_set'], { setId: SET_ID })).body).toEqual({ name: 'x', cards: [], media: {} })
  })

  it('import_all defaults to merge, passes replace only when explicit, reports errors', async () => {
    const importAll = vi.fn((_json: string, mode: string) => ({ ok: true as const, value: { mode } }))
    const t = tools(() => makeDeps({ importAll } as never))
    await call(t['import_all'], { json: '{}' })
    expect(importAll).toHaveBeenLastCalledWith('{}', 'merge')
    await call(t['import_all'], { json: '{}', mode: 'replace' })
    expect(importAll).toHaveBeenLastCalledWith('{}', 'replace')
    const failing = tools(() => makeDeps({ importAll: () => ({ ok: false, error: 'damaged' }) } as never))
    expect(await call(failing['import_all'], { json: '{}' })).toEqual({ isError: true, body: { error: 'damaged' } })
  })

  it('navigate validates targets and set existence', async () => {
    const deps = makeDeps({ state: { ...createEmptyAppState(), sets: [{ id: SET_ID }] } as never })
    const t = tools(() => deps)
    expect((await call(t['navigate'], { to: 'stats' })).body).toEqual({ navigatedTo: '/stats' })
    expect(deps.navigate).toHaveBeenCalledWith('/stats')
    expect((await call(t['navigate'], { to: 'set' })).isError).toBe(true)
    expect((await call(t['navigate'], { to: 'set', setId: OTHER_ID })).isError).toBe(true)
    expect((await call(t['navigate'], { to: 'set', setId: SET_ID })).body).toEqual({ navigatedTo: `/sets/${SET_ID}` })
  })
})
