import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, createEmptyAppState } from '../types'
import { saveKeybindingOverrides } from './keybindingStorage'
import { clearMirrors } from './persistence'
import { STORAGE_KEY } from './storage'
import { SeshatProvider, useSeshatStore } from './store'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** setItem that throws only for the app-state key (the availability probe must still pass). */
const failOnState = (error: Error) => (key: string) => {
  if (key === STORAGE_KEY) throw error
}

type Store = ReturnType<typeof useSeshatStore>

const mount = (): { readonly current: () => Store } => {
  let latest: Store | null = null
  const Probe = () => {
    latest = useSeshatStore()
    return null
  }
  render(
    <SeshatProvider>
      <Probe />
    </SeshatProvider>,
  )
  return {
    current: () => {
      if (latest === null) throw new Error('store not mounted')
      return latest
    },
  }
}

describe('SeshatProvider persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
    clearMirrors()
  })

  it('saves to localStorage and mirrors settings to the cookie', () => {
    const store = mount()
    act(() => store.current().updateSettings({ theme: 'dark' }))
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('"theme":"dark"')
    expect(document.cookie).toContain('seshat_settings=')
  })

  it('boots with mirrored settings when localStorage was wiped', () => {
    const first = mount()
    act(() => first.current().updateSettings({ theme: 'dark' }))
    cleanup()
    window.localStorage.clear()
    expect(mount().current().state.settings.theme).toBe('dark')
  })

  it('picks up changes made in another tab', () => {
    const store = mount()
    const next = { ...createEmptyAppState(), settings: { ...DEFAULT_SETTINGS, theme: 'dark' as const } }
    act(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: JSON.stringify(next) }))
    })
    expect(store.current().state.settings.theme).toBe('dark')
  })

  it('does not loop: hydrating from another tab writes nothing new', () => {
    const store = mount()
    const next = { ...createEmptyAppState(), settings: { ...DEFAULT_SETTINGS, theme: 'dark' as const } }
    const raw = JSON.stringify(next)
    window.localStorage.setItem(STORAGE_KEY, raw)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: raw }))
    })
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(raw)
    expect(store.current().state.settings.theme).toBe('dark')
  })
})

describe('SeshatProvider backup', () => {
  beforeEach(() => {
    window.localStorage.clear()
    clearMirrors()
  })

  const withSet = () => {
    const store = mount()
    act(() => {
      const set = store.current().addSet({ name: 'Bio', description: '', tags: [] })
      store.current().addCard(set.id, {
        prompt: 'Q',
        content: { kind: 'short-answer', answer: 'a', acceptableAnswers: [] },
        explanation: null,
        sourceRef: null,
        tags: [],
      })
    })
    return store
  }

  it('exports everything including keybinding overrides', () => {
    saveKeybindingOverrides({ 'flashcards.flip': 'Enter' })
    const store = withSet()
    const backup = store.current().exportAll()
    expect(backup.sets).toHaveLength(1)
    expect(backup.cards).toHaveLength(1)
    expect(backup.keybindings).toEqual({ 'flashcards.flip': 'Enter' })
  })

  it('replace-imports a JSON string live and persists keybindings', () => {
    const source = withSet()
    const json = JSON.stringify(source.current().exportAll())
    cleanup()
    window.localStorage.clear()
    saveKeybindingOverrides({})

    const target = mount()
    let result: ReturnType<Store['importAll']> | null = null
    act(() => {
      result = target.current().importAll(json, 'replace')
    })
    expect(result).toMatchObject({ ok: true, value: { mode: 'replace', setsAdded: 1, cardsAdded: 1 } })
    expect(target.current().state.sets).toHaveLength(1)
    expect(window.localStorage.getItem('seshat:keybindings:v1')).toBe('{}')
  })

  it('merge-imports a backup object without duplicating what exists', () => {
    const store = withSet()
    const backup = store.current().exportAll()
    let result: ReturnType<Store['importAll']> | null = null
    act(() => {
      result = store.current().importAll(backup, 'merge')
    })
    expect(result).toMatchObject({ ok: true, value: { setsAdded: 0, setsSkipped: 1, cardsSkipped: 1 } })
    expect(store.current().state.sets).toHaveLength(1)
  })

  it('returns an error and changes nothing for garbage input', () => {
    const store = withSet()
    let result: ReturnType<Store['importAll']> | null = null
    act(() => {
      result = store.current().importAll('{"nope":true}', 'replace')
    })
    expect(result).toMatchObject({ ok: false })
    expect(store.current().state.sets).toHaveLength(1)
  })
})

describe('SeshatProvider save errors', () => {
  beforeEach(() => {
    window.localStorage.clear()
    clearMirrors()
  })

  it('surfaces a quota failure, then clears it after a successful save', () => {
    const store = mount()
    expect(store.current().saveError).toBeNull()
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(failOnState(new DOMException('full', 'QuotaExceededError')))
    act(() => store.current().updateSettings({ theme: 'dark' }))
    expect(store.current().saveError).toEqual({ kind: 'quota-exceeded' })
    spy.mockRestore()
    act(() => store.current().updateSettings({ theme: 'light' }))
    expect(store.current().saveError).toBeNull()
  })

  it('reports other write failures as write-failed', () => {
    const store = mount()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(failOnState(new Error('boom')))
    act(() => store.current().updateSettings({ theme: 'dark' }))
    expect(store.current().saveError).toEqual({ kind: 'write-failed', message: 'boom' })
  })
})
