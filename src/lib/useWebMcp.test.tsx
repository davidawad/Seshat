import { act, cleanup, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearMirrors } from './persistence'
import { SeshatProvider, useSeshatStore } from './store'
import { useWebMcp } from './useWebMcp'
import type { ModelContextTool } from './webmcp'

const registered = new Map<string, ModelContextTool>()
const context = {
  registerTool: (tool: ModelContextTool, { signal }: { signal: AbortSignal }) => {
    if (registered.has(tool.name)) return Promise.reject(new Error('InvalidStateError'))
    registered.set(tool.name, tool)
    signal.addEventListener('abort', () => registered.delete(tool.name))
    return Promise.resolve()
  },
}

let latestStore: ReturnType<typeof useSeshatStore> | null = null
const Probe = () => {
  useWebMcp()
  latestStore = useSeshatStore()
  return null
}
const mount = () =>
  render(
    <StrictMode>
      <MemoryRouter>
        <SeshatProvider>
          <Probe />
        </SeshatProvider>
      </MemoryRouter>
    </StrictMode>,
  )

const call = async (name: string, input: unknown) => {
  let text = ''
  await act(async () => {
    text = (await registered.get(name)?.execute(input))?.content[0]?.text ?? ''
  })
  return JSON.parse(text) as unknown
}

const simpleSet = (name: string) => JSON.stringify({ name, terms: [{ term: 'q', definition: 'a' }] })
const setNames = () => latestStore?.state.sets.map((set) => set.name).sort()

beforeEach(() => {
  window.localStorage.clear()
  clearMirrors()
  registered.clear()
  Object.defineProperty(document, 'modelContext', { value: context, configurable: true })
})
afterEach(() => {
  cleanup()
  Reflect.deleteProperty(document, 'modelContext')
})

describe('useWebMcp', () => {
  it('registers once under StrictMode and unregisters on unmount', () => {
    const view = mount()
    expect(registered.size).toBe(9)
    view.unmount()
    expect(registered.size).toBe(0)
  })

  it('does nothing without modelContext', () => {
    Reflect.deleteProperty(document, 'modelContext')
    mount()
    expect(registered.size).toBe(0)
  })

  it('writes through the live store and reads current state', async () => {
    mount()
    await call('import_set', { json: simpleSet('Live') })
    expect(setNames()).toEqual(['Live'])
    expect(await call('list_sets', {})).toMatchObject([{ name: 'Live', cardCount: 1, new: 1 }])
  })

  it('import_all merge keeps data, replace swaps it', async () => {
    mount()
    await call('import_set', { json: simpleSet('Mine') })
    const backup = JSON.stringify(await call('export_all', {}))
    await call('import_set', { json: simpleSet('Extra') })
    await call('import_all', { json: backup })
    expect(setNames()).toEqual(['Extra', 'Mine'])
    await call('import_all', { json: backup, mode: 'replace' })
    expect(setNames()).toEqual(['Mine'])
    expect(await call('import_all', { json: '{"x":1}' })).toMatchObject({ error: expect.any(String) })
  })

  it('update_settings reaches the store', async () => {
    mount()
    await call('update_settings', { patch: { reducedMotion: true } })
    expect(latestStore?.state.settings.reducedMotion).toBe(true)
  })
})
