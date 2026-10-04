import { describe, expect, it, vi } from 'vitest'
import { DataUrlError, base64ToBytes, bytesToBase64, dataUrlToBlob } from './data-url'
import { cardMediaRefs, collectMediaRefs, mediaSummary } from './refs'
import {
  IngestError,
  cachedIngest,
  hasLegacyImage,
  ingestDataUrl,
  ingestMediaMap,
  upgradeCards,
  upgradeCardsLenient,
  upgradeContent,
  verifyStored,
} from './ingest'
import { prepareCardsForImport } from './import-prepare'
import { MediaStoreError, createMemoryMediaStore } from './store'
import type { MediaMap } from './types'
import { dataUrlOf, identityProcess, nodeBlob, occlusionCard, pngBytes, textCard } from './test-helpers'
import { sha256Hex } from './hash'

const deps = () => ({ store: createMemoryMediaStore(), process: identityProcess })

const readAll = (blob: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsArrayBuffer(blob)
  })

describe('data-url helpers', () => {
  it('round-trips bytes through base64, including large inputs (no stack overflow)', () => {
    const big = pngBytes(3, 200_000)
    expect(base64ToBytes(bytesToBase64(big))).toEqual(big)
    expect(bytesToBase64(new Uint8Array())).toBe('')
  })

  it('decodes base64 and percent-encoded data URLs and keeps the declared mime', async () => {
    const bytes = pngBytes(1, 10)
    const blob = dataUrlToBlob(dataUrlOf(bytes, 'image/jpeg'))
    expect(blob.type).toBe('image/jpeg')
    expect(await readAll(blob)).toEqual(bytes)
    const plain = dataUrlToBlob('data:image/png,%41%42')
    expect(Array.from(await readAll(plain))).toEqual([0x41, 0x42])
    expect(dataUrlToBlob('data:IMAGE/PNG;charset=x;base64,QUI=').type).toBe('image/png')
  })

  it.each([
    ['not a data URL', 'https://x/y.png'],
    ['bad base64', 'data:image/png;base64,@@@'],
    ['bad percent encoding', 'data:image/png,%E0%A4%A'],
    ['empty payload', 'data:image/png;base64,'],
  ])('rejects %s with DataUrlError', (_name, url) => {
    expect(() => dataUrlToBlob(url)).toThrow(DataUrlError)
  })

  it('base64ToBytes rejects invalid input', () => {
    expect(() => base64ToBytes('***')).toThrow(DataUrlError)
  })
})

describe('refs', () => {
  it('collects every ref a card holds and de-duplicates across cards', async () => {
    const store = createMemoryMediaStore()
    const a = await store.put(nodeBlob(pngBytes(1)), { width: 1, height: 1 })
    const b = await store.put(nodeBlob(pngBytes(2)), { width: 1, height: 1 })
    const c = await store.put(nodeBlob(pngBytes(3)), { width: 1, height: 1 })
    const text = { ...textCard(1), promptImage: a }
    const answer = {
      ...textCard(2),
      content: { kind: 'short-answer' as const, answer: 'x', acceptableAnswers: [], answerImage: b },
    }
    const occ = { ...occlusionCard(3, 'data:x'), content: { ...occlusionCard(3, 'x').content, image: c } }
    expect(cardMediaRefs(text)).toEqual([a])
    expect(cardMediaRefs(answer)).toEqual([b])
    expect(cardMediaRefs(occ as never)).toEqual([c])
    expect(cardMediaRefs(textCard(4))).toEqual([])
    expect([...collectMediaRefs([text, answer, occ as never, text]).keys()]).toEqual([a.id, b.id, c.id])
    expect(mediaSummary(a)).toEqual({ id: a.id, alt: '', width: 1, height: 1 })
    expect(mediaSummary(null)).toBeNull()
  })
})

describe('ingestDataUrl', () => {
  it('stores the processed image and verifies it by hash', async () => {
    const d = deps()
    const ref = await ingestDataUrl(dataUrlOf(pngBytes(1)), d)
    expect(ref).toMatchObject({ mime: 'image/png', width: 40, height: 30 })
    await expect(verifyStored(d.store, ref)).resolves.toBeUndefined()
  })

  it('classifies each failure by stage', async () => {
    const d = deps()
    await expect(ingestDataUrl('nope', d)).rejects.toMatchObject({ stage: 'decode' })
    await expect(
      ingestDataUrl(dataUrlOf(pngBytes(1)), { ...d, process: async () => Promise.reject(new Error('x')) }),
    ).rejects.toMatchObject({ stage: 'process' })
    const quota = {
      ...d.store,
      put: async () => {
        throw new MediaStoreError('quota-exceeded', 'full')
      },
    }
    await expect(ingestDataUrl(dataUrlOf(pngBytes(1)), { ...d, store: quota })).rejects.toMatchObject({
      stage: 'store',
      message: 'Browser storage is full.',
    })
    const other = {
      ...d.store,
      put: async () => {
        throw new Error('weird')
      },
    }
    await expect(ingestDataUrl(dataUrlOf(pngBytes(1)), { ...d, store: other })).rejects.toThrow(IngestError)
  })

  it('verifyStored rejects missing, wrong-size and wrong-hash blobs', async () => {
    const d = deps()
    const ref = await d.store.put(nodeBlob(pngBytes(1)), { width: 1, height: 1 })
    const gone = { ...d.store, get: async () => null }
    await expect(verifyStored(gone, ref)).rejects.toMatchObject({ stage: 'verify' })
    const wrongSize = { ...d.store, get: async () => nodeBlob(pngBytes(1, 3)) }
    await expect(verifyStored(wrongSize, ref)).rejects.toMatchObject({ stage: 'verify' })
    const wrongHash = { ...d.store, get: async () => nodeBlob(pngBytes(9, ref.bytes)) }
    await expect(verifyStored(wrongHash, ref)).rejects.toMatchObject({ stage: 'verify' })
    const throwing = {
      ...d.store,
      get: async () => {
        throw new Error('x')
      },
    }
    await expect(verifyStored(throwing, ref)).rejects.toMatchObject({ stage: 'verify' })
  })

  it('cachedIngest processes an identical data URL once', async () => {
    const process = vi.fn(identityProcess)
    const ingest = cachedIngest({ store: createMemoryMediaStore(), process })
    const url = dataUrlOf(pngBytes(1))
    const [a, b] = await Promise.all([ingest(url), ingest(url)])
    expect(a.id).toBe(b.id)
    expect(process).toHaveBeenCalledTimes(1)
  })
})

describe('upgrading card content', () => {
  const ingest = async () => cachedIngest(deps())

  it('replaces a legacy data URL with a ref and drops the field; leaves everything else', async () => {
    const run = await ingest()
    const card = occlusionCard(1, dataUrlOf(pngBytes(1)))
    expect(hasLegacyImage(card.content)).toBe(true)
    const upgraded = await upgradeContent(card.content, run)
    expect(upgraded).not.toHaveProperty('imageDataUrl')
    expect(upgraded).toMatchObject({ kind: 'image-occlusion', image: { mime: 'image/png' } })
    expect(hasLegacyImage(upgraded)).toBe(false)
    const text = textCard(2).content
    expect(await upgradeContent(text, run)).toBe(text)
  })

  it('strict upgrade throws on the first bad image; lenient keeps the card and counts it', async () => {
    const run = await ingest()
    const cards = [occlusionCard(1, dataUrlOf(pngBytes(1))), occlusionCard(2, 'bogus'), textCard(3)]
    await expect(upgradeCards(cards, run)).rejects.toThrow(IngestError)
    const lenient = await upgradeCardsLenient(cards, run)
    expect(lenient.failed).toBe(1)
    expect(lenient.cards[1]).toBe(cards[1])
    expect(lenient.cards[0]?.content).toMatchObject({ image: { mime: 'image/png' } })
  })
})

describe('ingestMediaMap and prepareCardsForImport', () => {
  const entry = async (seed: number) => {
    const bytes = pngBytes(seed)
    const id = await sha256Hex(bytes.buffer.slice(0) as ArrayBuffer)
    return { id, payload: { mime: 'image/png' as const, dataBase64: bytesToBase64(bytes), width: 5, height: 6 } }
  }

  it('stores entries whose id equals their content hash', async () => {
    const d = deps()
    const e = await entry(1)
    await ingestMediaMap(d.store, { [e.id]: e.payload })
    expect(await d.store.has(e.id)).toBe(true)
  })

  it('rejects an entry filed under another image’s id, and invalid base64', async () => {
    const d = deps()
    const e = await entry(1)
    const other = await entry(2)
    const lying: MediaMap = { [other.id]: e.payload }
    await expect(ingestMediaMap(d.store, lying)).rejects.toMatchObject({ stage: 'verify' })
    const bad: MediaMap = { [e.id]: { ...e.payload, dataBase64: '@@@' } }
    await expect(ingestMediaMap(d.store, bad)).rejects.toMatchObject({ stage: 'decode' })
    const failing = {
      ...d.store,
      put: async () => {
        throw new Error('disk')
      },
    }
    await expect(ingestMediaMap(failing, { [e.id]: e.payload })).rejects.toMatchObject({ stage: 'store' })
  })

  it('prepare: ingests media, upgrades v1 data URLs, and counts what is missing or kept inline', async () => {
    const d = deps()
    const e = await entry(1)
    const ref = { id: e.id, mime: 'image/png' as const, width: 5, height: 6, bytes: 64, alt: '', decorative: false }
    const withRef = { ...textCard(1), promptImage: ref }
    const absent = {
      ...textCard(2),
      promptImage: { ...ref, id: 'f'.repeat(64) },
    }
    const legacy = occlusionCard(3, dataUrlOf(pngBytes(5)))
    const broken = occlusionCard(4, 'bogus')
    const result = await prepareCardsForImport([withRef, absent, legacy, broken], { [e.id]: e.payload }, d)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.notConverted).toBe(1)
    expect(result.value.missing).toBe(1)
    expect(await d.store.has(e.id)).toBe(true)
    expect(result.value.cards[2]?.content).toMatchObject({ image: { mime: 'image/png' } })
  })

  it('prepare: a bad media entry fails the whole import with a readable error', async () => {
    const d = deps()
    const e = await entry(1)
    const result = await prepareCardsForImport([textCard(1)], { [e.id]: { ...e.payload, dataBase64: '@@@' } }, d)
    expect(result.ok).toBe(false)
    const thrower = await prepareCardsForImport(
      [textCard(1)],
      { [e.id]: e.payload },
      { ...d, store: { ...d.store, put: async () => Promise.reject(new MediaStoreError('failed', 'x')) } },
    )
    expect(thrower.ok).toBe(false)
  })
})
