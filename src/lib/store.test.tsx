import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, createEmptyAppState } from '../types'
import { saveKeybindingOverrides } from './keybindingStorage'
import { clearMirrors } from './persistence'
import { STORAGE_KEY } from './storage'
import { MediaStoreProvider } from './media/MediaStoreProvider'
import { createMemoryMediaStore } from './media/store'
import { dataUrlOf, nodeBlob, occlusionCard, pngBytes, stateWith, textCard } from './media/test-helpers'
import { createBackup } from './backup'
import { exportedSetSchema } from '../types'
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
        content: { kind: 'short-answer', answer: 'a', acceptableAnswers: [], answerImage: null },
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

  it('replace-imports a JSON string live and persists keybindings', async () => {
    const source = withSet()
    const json = JSON.stringify(source.current().exportAll())
    cleanup()
    window.localStorage.clear()
    saveKeybindingOverrides({})

    const target = mount()
    let result: Awaited<ReturnType<Store['importAll']>> | null = null
    await act(async () => {
      result = await target.current().importAll(json, 'replace')
    })
    expect(result).toMatchObject({ ok: true, value: { mode: 'replace', setsAdded: 1, cardsAdded: 1 } })
    expect(target.current().state.sets).toHaveLength(1)
    expect(window.localStorage.getItem('seshat:keybindings:v1')).toBe('{}')
  })

  it('merge-imports a backup object without duplicating what exists', async () => {
    const store = withSet()
    const backup = store.current().exportAll()
    let result: Awaited<ReturnType<Store['importAll']>> | null = null
    await act(async () => {
      result = await store.current().importAll(backup, 'merge')
    })
    expect(result).toMatchObject({ ok: true, value: { setsAdded: 0, setsSkipped: 1, cardsSkipped: 1 } })
    expect(store.current().state.sets).toHaveLength(1)
  })

  it('returns an error and changes nothing for garbage input', async () => {
    const store = withSet()
    let result: Awaited<ReturnType<Store['importAll']>> | null = null
    await act(async () => {
      result = await store.current().importAll('{"nope":true}', 'replace')
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

describe('SeshatProvider images on import', () => {
  beforeEach(() => {
    window.localStorage.clear()
    clearMirrors()
  })

  const mountWith = (media = createMemoryMediaStore()) => {
    let latest: Store | null = null
    const Probe = () => {
      latest = useSeshatStore()
      return null
    }
    render(
      <MediaStoreProvider store={media}>
        <SeshatProvider>
          <Probe />
        </SeshatProvider>
      </MediaStoreProvider>,
    )
    return () => latest as unknown as Store
  }

  it('importAll stores the backup media BEFORE state changes, and reports images it could not provide', async () => {
    const source = createMemoryMediaStore()
    const ref = await source.put(nodeBlob(pngBytes(1)), { width: 3, height: 3 })
    const state = stateWith([
      { ...textCard(1), promptImage: ref },
      { ...textCard(2), promptImage: { ...ref, id: 'f'.repeat(64) } },
    ])
    const withMedia = {
      ...createBackup(state, {}, new Date()),
      media: { [ref.id]: { mime: 'image/png', dataBase64: 'AAECAwQ=', width: 3, height: 3 } },
    }
    const target = createMemoryMediaStore()
    const current = mountWith(target)
    // The media entry's bytes do not hash to ref.id, so the whole import is refused and nothing changes.
    let result: Awaited<ReturnType<Store['importAll']>> | null = null
    await act(async () => {
      result = await current().importAll(JSON.stringify(withMedia), 'replace')
    })
    expect(result).toMatchObject({ ok: false })
    expect(current().state.cards).toHaveLength(0)
    expect(await target.list()).toHaveLength(0)
  })

  it('importAll with consistent media restores cards and blobs and reports missing images', async () => {
    const source = createMemoryMediaStore()
    const bytes = pngBytes(1)
    const ref = await source.put(nodeBlob(bytes), { width: 3, height: 3 })
    const { bytesToBase64 } = await import('./media/data-url')
    const state = stateWith([
      { ...textCard(1), promptImage: ref },
      { ...textCard(2), promptImage: { ...ref, id: 'f'.repeat(64) } },
    ])
    const file = {
      ...createBackup(state, {}, new Date()),
      media: { [ref.id]: { mime: 'image/png', dataBase64: bytesToBase64(bytes), width: 3, height: 3 } },
    }
    const target = createMemoryMediaStore()
    const current = mountWith(target)
    let result: Awaited<ReturnType<Store['importAll']>> | null = null
    await act(async () => {
      result = await current().importAll(JSON.stringify(file), 'replace')
    })
    expect(result).toMatchObject({ ok: true, value: { cardsAdded: 2, imagesMissing: 1 } })
    expect(await target.has(ref.id)).toBe(true)
    expect(current().state.cards[0]?.promptImage?.id).toBe(ref.id)
  })

  it('a v1-era set export keeps working: an image that cannot be decoded here stays inline instead of failing', async () => {
    const current = mountWith()
    const exported = exportedSetSchema.parse({
      seshatExportVersion: 1,
      name: 'Old',
      description: '',
      tags: [],
      cards: [
        {
          prompt: 'p',
          content: occlusionCard(1, dataUrlOf(pngBytes(1))).content,
          explanation: null,
          sourceRef: null,
          tags: [],
        },
      ],
    })
    let prepared: Awaited<ReturnType<Store['prepareSetImport']>> | null = null
    await act(async () => {
      prepared = await current().prepareSetImport(exported)
    })
    expect(prepared).toMatchObject({ ok: true })
    const ready = (prepared as unknown as { value: typeof exported }).value
    expect(ready).not.toHaveProperty('media')
    act(() => {
      current().importSet(ready)
    })
    expect(current().state.cards).toHaveLength(1)
  })

  it('exportSet carries each card’s promptImage', async () => {
    const current = mountWith()
    const set = current().addSet({ name: 'S', description: '', tags: [] })
    act(() => {
      current().addCard(set.id, {
        prompt: 'p',
        content: textCard(1).content,
        explanation: null,
        sourceRef: null,
        tags: [],
      })
    })
    expect(current().exportSet(set.id)?.cards[0]).toHaveProperty('promptImage', null)
  })

  it('replaceState swaps the in-memory state', () => {
    const current = mountWith()
    act(() => current().replaceState(stateWith([textCard(5)])))
    expect(current().state.cards).toHaveLength(1)
  })
})
