import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBackup } from './backup'
import { clearMirrors } from './persistence'
import { STORAGE_KEY } from './storage'
import { SeshatProvider, useSeshatStore } from './store'
import { TRY_SAMPLE_SET } from '../features/sets/try-sample'
import { createEmptyAppState, exportedSetSchema } from '../types'

afterEach(() => cleanup())
beforeEach(() => {
  window.localStorage.clear()
  clearMirrors()
})

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

const exported = exportedSetSchema.parse({
  seshatExportVersion: 1,
  name: 'Mine',
  description: '',
  tags: [],
  cards: [
    {
      prompt: 'Q',
      content: { kind: 'short-answer', answer: 'A', acceptableAnswers: [], answerImage: null },
      explanation: null,
      sourceRef: null,
      tags: [],
    },
  ],
})

describe('activation recorded by the store', () => {
  it('keeps the first set source (sample) when a real set follows, and arms the reminder', () => {
    const store = mount()
    act(() => void store.current().importSet(TRY_SAMPLE_SET, 'sample'))
    expect(store.current().state.activation.firstRealSetAt).toBeNull()
    act(() => void store.current().importSet(exported))
    const a = store.current().state.activation
    expect(a.firstSetSource).toBe('sample')
    expect(a.firstSetAt).not.toBeNull()
    expect(a.firstRealSetAt).not.toBeNull()
  })

  it('records import and create sources when they are the first set', () => {
    const first = mount()
    act(() => void first.current().importSet(exported))
    expect(first.current().state.activation.firstSetSource).toBe('import')
    cleanup()
    window.localStorage.clear()
    const second = mount()
    act(() => void second.current().addSet({ name: 'N', description: '', tags: [] }))
    expect(second.current().state.activation.firstSetSource).toBe('create')
  })

  it('counts graded reviews, the first graded time and days studied; undo lowers the total', () => {
    const store = mount()
    act(() => void store.current().importSet(exported))
    const card = store.current().state.cards[0]
    if (card === undefined) throw new Error('no card')
    let reviewedAt = ''
    act(() => {
      reviewedAt = store.current().recordReview(card.id, 'good', null, true, 1000) ?? ''
    })
    const a = store.current().state.activation
    expect(a).toMatchObject({ totalReviews: 1, daysStudied: 1 })
    expect(a.firstGradedAt).toBe(reviewedAt)
    act(() => store.current().undoReview(card.id, card.scheduling, reviewedAt))
    expect(store.current().state.activation.totalReviews).toBe(0)
  })

  it('stamps the backup time and the dismissal, and persists both', () => {
    const store = mount()
    act(() => void store.current().importSet(exported))
    act(() => store.current().recordBackupDownloaded())
    act(() => store.current().dismissBackupNudge())
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}').activation
    expect(saved.lastBackupAt).toEqual(expect.any(String))
    expect(saved.nudgeDismissedAt).toEqual(expect.any(String))
  })

  it('a Replace restore keeps this device activation, and a backup file carries none', async () => {
    const store = mount()
    act(() => void store.current().importSet(exported))
    const before = store.current().state.activation
    const backup = createBackup(createEmptyAppState(), {}, new Date())
    expect(Object.keys(backup)).not.toContain('activation')
    await act(async () => {
      await store.current().importAll(backup, 'replace')
    })
    expect(store.current().state.activation).toEqual(before)
  })
})
