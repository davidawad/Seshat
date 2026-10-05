import { afterEach, describe, expect, it, vi } from 'vitest'
import { collectReferencedIds, selectOrphans } from './gc'
import { readBlobBytes, sha256Hex } from './hash'
import { mediaIdSchema, mediaRefSchema } from './types'

const EMPTY_SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
const ABC_SHA = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

afterEach(() => vi.unstubAllGlobals())

describe('sha256Hex', () => {
  it('hashes ArrayBuffers and Blobs identically to the known digest', async () => {
    const bytes = new TextEncoder().encode('abc')
    expect(await sha256Hex(bytes.buffer as ArrayBuffer)).toBe(ABC_SHA)
    expect(await sha256Hex(new Blob(['abc']))).toBe(ABC_SHA)
    expect(await sha256Hex(new ArrayBuffer(0))).toBe(EMPTY_SHA)
  })

  it('throws a clear error without crypto.subtle', async () => {
    vi.stubGlobal('crypto', {})
    await expect(sha256Hex(new ArrayBuffer(1))).rejects.toThrow(/crypto\.subtle/)
  })
})

describe('readBlobBytes', () => {
  it('falls back to FileReader when Blob.arrayBuffer is missing', async () => {
    const blob = new Blob(['hi'])
    Object.defineProperty(blob, 'arrayBuffer', { value: undefined })
    expect(new TextDecoder().decode(await readBlobBytes(blob))).toBe('hi')
  })
})

describe('selectOrphans', () => {
  const DAY = 24 * 60 * 60 * 1000
  const created = new Map([
    ['old-unref', 0],
    ['old-ref', 0],
    ['new-unref', 9.5 * DAY],
    ['edge', 0],
  ])

  it('selects only unreferenced ids older than the grace period', () => {
    const out = selectOrphans(['old-unref', 'old-ref', 'new-unref', 'unknown'], new Set(['old-ref']), {
      nowMs: 10 * DAY,
      createdAtById: created,
    })
    expect(out).toEqual(['old-unref'])
  })

  it('treats exactly-grace-old as collectable and honours a custom grace', () => {
    expect(selectOrphans(['edge'], new Set(), { nowMs: DAY, createdAtById: created })).toEqual(['edge'])
    expect(selectOrphans(['edge'], new Set(), { nowMs: DAY - 1, createdAtById: created })).toEqual([])
    expect(selectOrphans(['new-unref'], new Set(), { nowMs: 10 * DAY, createdAtById: created, graceMs: 0 })).toEqual([
      'new-unref',
    ])
  })
})

describe('collectReferencedIds', () => {
  it('unions ids from an accessor across items', () => {
    const cards = [{ ids: ['a', 'b'] }, { ids: [] }, { ids: ['b', 'c'] }]
    expect(collectReferencedIds(cards, (c) => c.ids)).toEqual(new Set(['a', 'b', 'c']))
  })
})

describe('media schemas', () => {
  const id = 'a'.repeat(64)
  it('validates ids and applies ref defaults', () => {
    expect(mediaIdSchema.safeParse(id).success).toBe(true)
    expect(mediaIdSchema.safeParse('A'.repeat(64)).success).toBe(false)
    expect(mediaIdSchema.safeParse('abc').success).toBe(false)
    expect(mediaRefSchema.parse({ id, mime: 'image/webp', width: 1, height: 2, bytes: 3 })).toEqual({
      id,
      mime: 'image/webp',
      width: 1,
      height: 2,
      bytes: 3,
      alt: '',
      decorative: false,
    })
    expect(mediaRefSchema.safeParse({ id, mime: 'image/gif', width: 1, height: 2, bytes: 3 }).success).toBe(false)
  })
})
