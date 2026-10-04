import { bytesToBase64 } from './data-url'
import { readBlobBytes } from './hash'
import type { MediaStore } from './store'
import type { MediaMap, MediaPayload, MediaRef } from './types'

/**
 * Putting stored images into a backup / set export as base64 `media` entries.
 * A ref whose blob is missing from the store is skipped and reported (never
 * silently dropped, never fatal: the rest of the export is still worth having).
 */

const payloadFor = async (store: MediaStore, ref: MediaRef): Promise<MediaPayload | null> => {
  const blob = await store.get(ref.id)
  if (blob === null) return null
  const bytes = new Uint8Array(await readBlobBytes(blob))
  return { mime: ref.mime, dataBase64: bytesToBase64(bytes), width: ref.width, height: ref.height }
}

export interface MediaExport<T> {
  readonly value: T
  /** Ids the document references but the store no longer holds (their images are not in the export). */
  readonly missing: readonly string[]
}

/** The `media` object for `refs`, held in memory (per-set export, window.seshat / WebMCP). */
export const loadMediaMap = async (
  store: MediaStore,
  refs: ReadonlyMap<string, MediaRef>,
): Promise<MediaExport<MediaMap>> => {
  const media: Record<string, MediaPayload> = {}
  const missing: string[] = []
  for (const [id, ref] of refs) {
    const payload = await payloadFor(store, ref)
    if (payload === null) missing.push(id)
    else media[id] = payload
  }
  return { value: media, missing }
}

/**
 * `doc` (an object WITHOUT a `media` key) plus a `media` map, as a Blob built
 * from parts: each image's base64 goes into its own small Blob as soon as it is
 * read, so the whole file is never one giant JavaScript string.
 */
export const toJsonBlobWithMedia = async (
  doc: object,
  store: MediaStore,
  refs: ReadonlyMap<string, MediaRef>,
): Promise<MediaExport<Blob>> => {
  const head = JSON.stringify(doc)
  const entries: Blob[] = []
  const missing: string[] = []
  for (const [id, ref] of refs) {
    const payload = await payloadFor(store, ref)
    if (payload === null) {
      missing.push(id)
      continue
    }
    entries.push(new Blob([`${entries.length === 0 ? '' : ','}${JSON.stringify(id)}:${JSON.stringify(payload)}`]))
  }
  const blob = new Blob([`${head.slice(0, -1)},"media":{`, ...entries, '}}'], { type: 'application/json' })
  return { value: blob, missing }
}
