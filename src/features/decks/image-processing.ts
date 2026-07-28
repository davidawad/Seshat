/**
 * Client-side image downscale/compression for image-occlusion cards. There
 * is no blob store — the image lives as a `data:` URL inside the same
 * single localStorage blob as everything else (see lib/storage.ts), which
 * has a hard ~5-10MB-per-origin ceiling shared across the whole app. An
 * uploaded image is downscaled and re-compressed before it's ever assigned
 * to `imageDataUrl`, instead of being stored at its original resolution.
 */

/** Longest edge, in px, an uploaded image is downscaled to before compression. Diagrams stay legible well below this. */
export const MAX_IMAGE_EDGE_PX = 1200

/** Quality passed to `canvas.toDataURL('image/jpeg', ...)` — balances file size against legibility of diagram text/labels. */
export const IMAGE_JPEG_QUALITY = 0.82

/** Above this, warn the user inline (not a hard block) that the image is eating into the shared localStorage budget. */
export const IMAGE_SIZE_WARNING_BYTES = 500 * 1024

/**
 * Scales `(sourceWidth, sourceHeight)` down so its longest edge is at most
 * `maxEdgePx`, preserving aspect ratio. Never upscales a smaller image.
 */
export const computeScaledDimensions = (
  sourceWidth: number,
  sourceHeight: number,
  maxEdgePx: number,
): { readonly width: number; readonly height: number } => {
  const longestEdge = Math.max(sourceWidth, sourceHeight)
  const scale = longestEdge > maxEdgePx ? maxEdgePx / longestEdge : 1
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  }
}

/** Estimates the byte size of a `data:` URL from its base64 payload length, without decoding it. */
export const estimateDataUrlBytes = (dataUrl: string): number => {
  const commaIndex = dataUrl.indexOf(',')
  const base64 = commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1)
  if (base64.length === 0) return 0
  const paddingChars = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - paddingChars)
}

/** Whether a `data:` URL is large enough to warn about localStorage pressure. */
export const isImageDataUrlOversized = (dataUrl: string): boolean =>
  estimateDataUrlBytes(dataUrl) > IMAGE_SIZE_WARNING_BYTES

/**
 * Reads an uploaded image file, downscales it so its longest edge is at
 * most `MAX_IMAGE_EDGE_PX`, and re-encodes it as a compressed JPEG data
 * URL. Depends on browser APIs (FileReader/Image/canvas) that jsdom can't
 * meaningfully exercise — the pure size math it relies on
 * (`computeScaledDimensions`, `estimateDataUrlBytes`) is unit-tested
 * separately.
 */
export const downscaleImageFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.onload = () => {
      const sourceDataUrl = reader.result
      if (typeof sourceDataUrl !== 'string') {
        reject(new Error('Could not read the selected file.'))
        return
      }
      const image = new Image()
      image.onerror = () => reject(new Error('Could not decode the selected file as an image.'))
      image.onload = () => {
        const { width, height } = computeScaledDimensions(image.naturalWidth, image.naturalHeight, MAX_IMAGE_EDGE_PX)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (context === null) {
          reject(new Error('This browser does not support the canvas API needed to process images.'))
          return
        }
        context.drawImage(image, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY))
      }
      image.src = sourceDataUrl
    }
    reader.readAsDataURL(file)
  })
