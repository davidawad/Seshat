import type { CardContent } from '../../types'
import { DataUrlError, base64ToBytes, dataUrlToBlob } from './data-url'
import { sha256Hex } from './hash'
import { ImagePipelineError, type ProcessedImage } from './image-pipeline'
import { MediaStoreError, type MediaStore } from './store'
import type { MediaMap, MediaRef } from './types'

/**
 * Turning images from outside the media store (legacy data URLs, base64 in a
 * backup) into stored blobs. Shared by the boot migration (strict: any failure
 * aborts it) and by backup / set import (lenient: a bad image keeps its legacy
 * data URL instead of failing the whole import).
 */

export type IngestStage = 'decode' | 'process' | 'store' | 'verify'

export class IngestError extends Error {
  readonly stage: IngestStage
  constructor(stage: IngestStage, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'IngestError'
    this.stage = stage
  }
}

export interface IngestDeps {
  readonly store: MediaStore
  /** The image pipeline (processImage in the browser; a fake in tests). Must never upscale. */
  readonly process: (blob: Blob) => Promise<ProcessedImage>
}

const describeError = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))

/** Reads a blob back out of the store and proves its bytes hash to the id it was stored under. */
export const verifyStored = async (store: MediaStore, ref: MediaRef): Promise<void> => {
  let stored: Blob | null
  try {
    stored = await store.get(ref.id)
  } catch (cause) {
    throw new IngestError('verify', `Could not read a stored image back: ${describeError(cause)}`, { cause })
  }
  if (stored === null) throw new IngestError('verify', 'A stored image could not be read back.')
  if (stored.size !== ref.bytes) throw new IngestError('verify', 'A stored image has the wrong size.')
  let hash: string
  try {
    hash = await sha256Hex(stored)
  } catch (cause) {
    throw new IngestError('verify', 'Could not hash a stored image.', { cause })
  }
  if (hash !== ref.id) throw new IngestError('verify', 'A stored image does not match its hash.')
}

/** data URL -> pipeline (never upscales) -> store -> read back and verify. Throws IngestError. */
export const ingestDataUrl = async (dataUrl: string, { store, process }: IngestDeps): Promise<MediaRef> => {
  let blob: Blob
  try {
    blob = dataUrlToBlob(dataUrl)
  } catch (cause) {
    const message = cause instanceof DataUrlError ? cause.message : describeError(cause)
    throw new IngestError('decode', `Could not decode an image: ${message}`, { cause })
  }
  let processed: ProcessedImage
  try {
    processed = await process(blob)
  } catch (cause) {
    const message = cause instanceof ImagePipelineError ? cause.message : describeError(cause)
    throw new IngestError('process', `Could not process an image: ${message}`, { cause })
  }
  let ref: MediaRef
  try {
    ref = await store.put(processed.blob, { width: processed.width, height: processed.height })
  } catch (cause) {
    const quota = cause instanceof MediaStoreError && cause.kind === 'quota-exceeded'
    throw new IngestError(
      'store',
      quota ? 'Browser storage is full.' : `Could not store an image: ${describeError(cause)}`,
      {
        cause,
      },
    )
  }
  await verifyStored(store, ref)
  return ref
}

/** Same data URL twice (the same picture on several cards) is processed and stored once. */
export const cachedIngest = (deps: IngestDeps): ((dataUrl: string) => Promise<MediaRef>) => {
  const cache = new Map<string, Promise<MediaRef>>()
  return (dataUrl) => {
    const hit = cache.get(dataUrl)
    if (hit !== undefined) return hit
    const pending = ingestDataUrl(dataUrl, deps)
    cache.set(dataUrl, pending)
    return pending
  }
}

/** True when `content` still carries a legacy inline image that has no MediaRef yet. */
export const hasLegacyImage = (content: CardContent): boolean =>
  content.kind === 'image-occlusion' && content.image === null && content.imageDataUrl !== undefined

/** Content with its legacy data URL replaced by a stored MediaRef; anything else is returned as-is. */
export const upgradeContent = async (
  content: CardContent,
  ingest: (dataUrl: string) => Promise<MediaRef>,
): Promise<CardContent> => {
  if (content.kind !== 'image-occlusion' || content.image !== null || content.imageDataUrl === undefined) return content
  const image = await ingest(content.imageDataUrl)
  const { imageDataUrl: _legacy, ...rest } = content
  return { ...rest, image }
}

/** Strict: upgrades every card or throws on the first failure (used by the boot migration). */
export const upgradeCards = async <T extends { readonly content: CardContent }>(
  cards: readonly T[],
  ingest: (dataUrl: string) => Promise<MediaRef>,
): Promise<T[]> => {
  const out: T[] = []
  for (const card of cards) out.push({ ...card, content: await upgradeContent(card.content, ingest) })
  return out
}

/** Lenient: a card whose image cannot be ingested keeps its legacy data URL; the count of those is returned. */
export const upgradeCardsLenient = async <T extends { readonly content: CardContent }>(
  cards: readonly T[],
  ingest: (dataUrl: string) => Promise<MediaRef>,
): Promise<{ readonly cards: T[]; readonly failed: number }> => {
  const out: T[] = []
  let failed = 0
  for (const card of cards) {
    try {
      out.push({ ...card, content: await upgradeContent(card.content, ingest) })
    } catch {
      failed += 1
      out.push(card)
    }
  }
  return { cards: out, failed }
}

/**
 * Stores every blob of a backup / export `media` map. Each entry is hashed by
 * the store, and the id it was filed under must equal its content hash, so a
 * file cannot smuggle bytes in under another image's id. Throws IngestError.
 */
export const ingestMediaMap = async (store: MediaStore, media: MediaMap): Promise<void> => {
  for (const [id, payload] of Object.entries(media)) {
    let blob: Blob
    try {
      blob = new Blob([base64ToBytes(payload.dataBase64)], { type: payload.mime })
    } catch (cause) {
      throw new IngestError('decode', `Image ${id.slice(0, 8)} in the file is not valid base64.`, { cause })
    }
    // Check the claimed id BEFORE storing, so a lying entry never leaves a stray blob behind.
    if ((await sha256Hex(blob).catch(() => null)) !== id) {
      throw new IngestError('verify', `Image ${id.slice(0, 8)} in the file does not match its id.`)
    }
    let ref: MediaRef
    try {
      ref = await store.put(blob, { width: payload.width, height: payload.height })
    } catch (cause) {
      throw new IngestError('store', `Could not store image ${id.slice(0, 8)}: ${describeError(cause)}`, { cause })
    }
    if (ref.id !== id) throw new IngestError('verify', `Image ${id.slice(0, 8)} in the file does not match its id.`)
  }
}
