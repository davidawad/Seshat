import { Blob as NodeBlob } from 'node:buffer'
import { expect } from 'vitest'
import { type AppState, type StudyCard, createEmptyAppState } from '../../types'
import { LEGACY_STORAGE_KEY, STORAGE_KEY, parseLegacyState } from '../storage'
import { bytesToBase64 } from './data-url'
import { createInitialScheduling } from '../fsrs'
import type { ProcessedImage } from './image-pipeline'
import type { LegacyStore } from './legacy-store'
import type { WithLock } from './locks'
import { type MigrationDeps, type StateStorage, migrationPending } from './migrate'
import { createMemoryMediaStore, type MediaStore } from './store'

/** Shared fixtures for the migration / import / backup tests. Not imported by app code. */

export const SET_ID = '11111111-1111-4111-8111-111111111111'
const NOW = '2026-10-03T12:00:00.000Z'

/** jsdom's Blob does not survive fake-indexeddb's structured clone (real browsers keep it), so images use Node's. */
export const nodeBlob = (bytes: Uint8Array, type = 'image/png'): Blob =>
  new NodeBlob([bytes], { type }) as unknown as Blob

export const pngBytes = (seed: number, length = 64): Uint8Array =>
  Uint8Array.from({ length }, (_, i) => (seed * 31 + i * 7) % 256)

export const dataUrlOf = (bytes: Uint8Array, mime = 'image/png'): string =>
  `data:${mime};base64,${bytesToBase64(bytes)}`

/** A stand-in for processImage: passes the bytes through untouched (it never upscales), at a fixed size. */
export const identityProcess = async (blob: Blob): Promise<ProcessedImage> => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const mime = blob.type === 'image/jpeg' || blob.type === 'image/webp' ? blob.type : 'image/png'
  return { blob: nodeBlob(bytes, mime), width: 40, height: 30, mime }
}

export const textCard = (n: number): StudyCard => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as StudyCard['id'],
  setId: SET_ID as StudyCard['setId'],
  prompt: `Q${n}`,
  promptImage: null,
  content: { kind: 'short-answer', answer: `A${n}`, acceptableAnswers: [], answerImage: null },
  explanation: null,
  sourceRef: null,
  tags: [],
  createdAt: NOW,
  updatedAt: NOW,
  scheduling: createInitialScheduling(new Date(NOW)),
})

export const occlusionCard = (n: number, imageDataUrl: string): StudyCard => ({
  ...textCard(n),
  prompt: `Label ${n}`,
  content: {
    kind: 'image-occlusion',
    image: null,
    imageDataUrl,
    occlusions: [{ id: `r${n}`, xPct: 10, yPct: 10, widthPct: 20, heightPct: 20, label: `Part ${n}` }],
  },
})

export const stateWith = (cards: readonly StudyCard[]): AppState => ({
  ...createEmptyAppState(),
  sets: [
    {
      id: SET_ID as AppState['sets'][number]['id'],
      name: 'Set',
      description: '',
      tags: [],
      createdAt: NOW,
      updatedAt: NOW,
      goalDate: null,
    },
  ],
  cards: [...cards],
})

/** A v1 envelope as the pre-migration app wrote it. */
export const v1Raw = (state: AppState): string => JSON.stringify({ ...state, version: 1 })

export interface FakeStorage extends StateStorage {
  readonly data: Map<string, string>
  failWriteFor: string | null
  /** Silently drop writes to this key (a write that "succeeds" but does not land). */
  dropWriteFor: string | null
  failRemoveFor: string | null
}

export const fakeStorage = (initial: Record<string, string> = {}): FakeStorage => {
  const data = new Map(Object.entries(initial))
  const self: FakeStorage = {
    data,
    failWriteFor: null,
    dropWriteFor: null,
    failRemoveFor: null,
    read: (key) => data.get(key) ?? null,
    write(key, value) {
      if (self.failWriteFor === key) return { ok: false, error: { kind: 'quota-exceeded' } }
      if (self.dropWriteFor !== key) data.set(key, value)
      return { ok: true, value: undefined }
    },
    remove(key) {
      if (self.failRemoveFor !== key) data.delete(key)
    },
  }
  return self
}

/** Serialises callers the way navigator.locks does for one name. */
export const mutexLock = (): WithLock => {
  let tail: Promise<unknown> = Promise.resolve()
  return <T>(_name: string, fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn)
    tail = run.catch(() => undefined)
    return run
  }
}

export const noLock: WithLock = (_name, fn) => fn()

export const memoryLegacy = (): LegacyStore & { readonly data: Map<string, string> } => {
  const data = new Map<string, string>()
  return {
    data,
    put: async (key, value) => {
      data.set(key, value)
    },
    get: async (key) => data.get(key) ?? null,
  }
}

export interface Harness extends MigrationDeps {
  readonly storage: FakeStorage
  readonly store: MediaStore
  readonly legacy: ReturnType<typeof memoryLegacy>
}

export const harness = (over: Partial<MigrationDeps> = {}): Harness =>
  ({
    storage: fakeStorage(),
    store: createMemoryMediaStore(),
    legacy: memoryLegacy(),
    process: identityProcess,
    withLock: mutexLock(),
    ...over,
  }) as Harness

export const withV1 = (
  cards: readonly StudyCard[],
  over: Parameters<typeof harness>[0] = {},
): { h: Harness; raw: string } => {
  const raw = v1Raw(stateWith(cards))
  const h = harness({ storage: fakeStorage({ [LEGACY_STORAGE_KEY]: raw }), ...over })
  return { h, raw }
}

export const imageCards = () => [
  textCard(1),
  occlusionCard(2, dataUrlOf(pngBytes(1))),
  occlusionCard(3, dataUrlOf(pngBytes(2))),
  occlusionCard(4, dataUrlOf(pngBytes(1))), // same picture as card 2
]

/** After ANY failed run: v1 byte-identical, no v2, the app can still load from v1. */
export const expectV1Intact = (h: Harness, raw: string) => {
  expect(h.storage.read(LEGACY_STORAGE_KEY)).toBe(raw)
  expect(h.storage.read(STORAGE_KEY)).toBeNull()
  expect(migrationPending(h.storage)).toBe(true)
  expect(parseLegacyState(h.storage.read(LEGACY_STORAGE_KEY) ?? '').ok).toBe(true)
}
