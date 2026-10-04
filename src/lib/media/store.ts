import { sha256Hex } from './hash'
import { mediaMimeSchema, type MediaRef } from './types'

export type MediaStoreErrorKind = 'quota-exceeded' | 'unavailable' | 'failed'

/** The only error type a MediaStore throws to callers. */
export class MediaStoreError extends Error {
  readonly kind: MediaStoreErrorKind
  constructor(kind: MediaStoreErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'MediaStoreError'
    this.kind = kind
  }
}

/**
 * `width`/`height` are the decoded pixel size (processImage returns them). When
 * omitted the store probes the blob with createImageBitmap, and fails if it cannot.
 */
export interface PutMeta {
  readonly alt?: string
  readonly decorative?: boolean
  readonly width?: number
  readonly height?: number
}

export interface StoredMediaInfo {
  readonly id: string
  readonly bytes: number
  readonly createdAt: number
}

export interface MediaUsage {
  readonly bytes: number
  readonly count: number
  readonly quota?: number
  readonly persisted?: boolean
}

export interface MediaStore {
  /** Resolves only after the write has fully committed. Dedupes by content hash. */
  put(blob: Blob, meta?: PutMeta): Promise<MediaRef>
  get(id: string): Promise<Blob | null>
  has(id: string): Promise<boolean>
  delete(id: string): Promise<void>
  list(): Promise<readonly StoredMediaInfo[]>
  usage(): Promise<MediaUsage>
}

/** What a store persists per blob (the IndexedDB record, minus the key duplication). */
export interface BlobDescription {
  readonly id: string
  readonly mime: MediaRef['mime']
  readonly bytes: number
  readonly width: number
  readonly height: number
}

const probeSize = async (blob: Blob): Promise<{ width: number; height: number }> => {
  if (typeof createImageBitmap !== 'function') {
    throw new MediaStoreError('failed', 'Image size was not provided and this browser cannot probe it.')
  }
  try {
    const bitmap = await createImageBitmap(blob)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close?.()
    return size
  } catch (cause) {
    throw new MediaStoreError('failed', 'Could not read the image to determine its size.', { cause })
  }
}

/** Hashes and validates a blob so every store derives identical ids/refs. */
export const describeBlob = async (blob: Blob, meta: PutMeta = {}): Promise<BlobDescription> => {
  const mime = mediaMimeSchema.safeParse(blob.type)
  if (!mime.success) {
    throw new MediaStoreError('failed', `Unsupported image type "${blob.type}"; expected WebP, JPEG or PNG.`)
  }
  let id: string
  try {
    id = await sha256Hex(blob)
  } catch (cause) {
    throw new MediaStoreError('unavailable', 'Cannot hash image (Web Crypto unavailable).', { cause })
  }
  const size =
    meta.width !== undefined && meta.height !== undefined
      ? { width: meta.width, height: meta.height }
      : await probeSize(blob)
  return { id, mime: mime.data, bytes: blob.size, ...size }
}

export const toRef = (desc: BlobDescription, meta: PutMeta = {}): MediaRef => ({
  id: desc.id,
  mime: desc.mime,
  width: desc.width,
  height: desc.height,
  bytes: desc.bytes,
  alt: meta.alt ?? '',
  decorative: meta.decorative ?? false,
})

/** Quota/persistence figures from the Storage API; every field is best-effort. */
export const readStorageEstimate = async (): Promise<{ quota?: number; persisted?: boolean }> => {
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage
  if (!storage) return {}
  const [estimate, persisted] = await Promise.all([
    storage.estimate?.().catch(() => undefined),
    storage.persisted?.().catch(() => undefined),
  ])
  return {
    ...(estimate?.quota === undefined ? {} : { quota: estimate.quota }),
    ...(persisted === undefined ? {} : { persisted }),
  }
}

interface MemoryEntry {
  readonly blob: Blob
  readonly desc: BlobDescription
  readonly createdAt: number
}

/** In-memory store: the test fake, and the fallback when IndexedDB is unavailable. */
export const createMemoryMediaStore = (now: () => number = Date.now): MediaStore => {
  const entries = new Map<string, MemoryEntry>()
  return {
    async put(blob, meta) {
      const desc = await describeBlob(blob, meta)
      const existing = entries.get(desc.id)
      if (existing) return toRef(existing.desc, meta)
      entries.set(desc.id, { blob, desc, createdAt: now() })
      return toRef(desc, meta)
    },
    get: async (id) => entries.get(id)?.blob ?? null,
    has: async (id) => entries.has(id),
    delete: async (id) => {
      entries.delete(id)
    },
    list: async () =>
      Array.from(entries.values(), (e) => ({ id: e.desc.id, bytes: e.desc.bytes, createdAt: e.createdAt })),
    async usage() {
      const all = Array.from(entries.values())
      return {
        bytes: all.reduce((sum, e) => sum + e.desc.bytes, 0),
        count: all.length,
        ...(await readStorageEstimate()),
      }
    },
  }
}
