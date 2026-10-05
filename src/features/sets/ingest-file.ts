import { ImagePipelineError, type MediaRef, type MediaStore, MediaStoreError, processImage } from '../../lib/media'

/** Picked / pasted / dropped file -> pipeline (long edge capped at 2048px, metadata stripped) -> IndexedDB store -> MediaRef. */
export const ingestImageFile = async (
  file: Blob,
  store: MediaStore,
  process: typeof processImage = processImage,
): Promise<MediaRef> => {
  try {
    const processed = await process(file)
    return await store.put(processed.blob, { width: processed.width, height: processed.height })
  } catch (cause) {
    if (cause instanceof ImagePipelineError) throw cause
    if (cause instanceof MediaStoreError && cause.kind === 'quota-exceeded') {
      throw new Error('Browser storage is full. Remove some images and try again.', { cause })
    }
    throw new Error(cause instanceof Error ? cause.message : 'Could not store the image.', { cause })
  }
}

/** The first image file in a paste / drop payload, if any. */
export const firstImageFile = (files: FileList | readonly File[] | null | undefined): File | null =>
  Array.from(files ?? []).find((file) => file.type.startsWith('image/')) ?? null
