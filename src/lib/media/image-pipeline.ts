import { readBlobBytes } from './hash'
import {
  chooseOutputFormat,
  clampMaxEdge,
  computeTargetSize,
  DEFAULT_MAX_BYTES,
  detectAlpha,
  looksLikeLineArt,
} from './image-format'
import type { MediaMime } from './types'

export type ImagePipelineErrorKind =
  'not-an-image' | 'svg-unsupported' | 'unreadable-format' | 'too-large' | 'encode-failed'

export class ImagePipelineError extends Error {
  readonly kind: ImagePipelineErrorKind
  constructor(kind: ImagePipelineErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ImagePipelineError'
    this.kind = kind
  }
}

export interface ProcessedImage {
  readonly blob: Blob
  readonly width: number
  readonly height: number
  readonly mime: MediaMime
}

export interface ProcessOptions {
  /** Long-edge cap in px. Default 2048, hard max 3072. */
  readonly maxEdge?: number
  /** Encoded size cap in bytes. Default 4 MB. */
  readonly maxBytes?: number
}

/** The minimal slice of a 2D canvas the pipeline uses; tests supply fakes. */
export interface CanvasLike {
  width: number
  height: number
  getContext(kind: '2d'): CanvasContextLike | null
  toBlob(callback: (blob: Blob | null) => void, type?: string, quality?: number): void
}
interface CanvasContextLike {
  fillStyle: string | CanvasGradient | CanvasPattern
  fillRect(x: number, y: number, w: number, h: number): void
  drawImage(source: never, dx: number, dy: number, dw: number, dh: number): void
  getImageData(x: number, y: number, w: number, h: number): { data: ArrayLike<number> }
}
interface DecodedImage {
  readonly width: number
  readonly height: number
  readonly source: unknown
  close(): void
}

/** Browser-only seams, injectable so the logic is testable without a real decoder/canvas. */
export interface PipelineDeps {
  decode(file: Blob): Promise<DecodedImage>
  createCanvas(width: number, height: number): CanvasLike
}

export const browserDeps: PipelineDeps = {
  // 'from-image' applies EXIF orientation explicitly; the bitmap is then upright pixels.
  // For animated GIF/WebP this yields the first frame.
  decode: async (file) => {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { width: bitmap.width, height: bitmap.height, source: bitmap, close: () => bitmap.close() }
  },
  createCanvas: (width, height) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  },
}

const QUALITIES = [0.85, 0.7, 0.55] as const
const EDGE_SHRINK = 0.8
const MAX_EDGE_STEPS = 6
const MIN_EDGE = 128

const looksLikeSvg = async (file: Blob): Promise<boolean> => {
  if (file.type === 'image/svg+xml') return true
  if ('name' in file && typeof file.name === 'string' && /\.svgz?$/i.test(file.name)) return true
  const head = new TextDecoder().decode(await readBlobBytes(file.slice(0, 512)))
  return /<svg[\s>]/i.test(head)
}

const rejectUnsupportedInput = async (file: Blob): Promise<void> => {
  if (file.type !== '' && !file.type.startsWith('image/')) {
    throw new ImagePipelineError('not-an-image', `"${file.type}" is not an image file.`)
  }
  if (await looksLikeSvg(file)) {
    throw new ImagePipelineError(
      'svg-unsupported',
      'SVG images are not supported because they can contain scripts. Export it as PNG or JPEG instead.',
    )
  }
}

const encode = (canvas: CanvasLike, type: MediaMime, quality?: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality))

const render = (
  deps: PipelineDeps,
  image: DecodedImage,
  size: { width: number; height: number },
  flattenToWhite: boolean,
): { canvas: CanvasLike; ctx: CanvasContextLike } => {
  const canvas = deps.createCanvas(size.width, size.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImagePipelineError('encode-failed', 'This browser cannot create a drawing surface.')
  if (flattenToWhite) {
    ctx.fillStyle = 'white' // JPEG has no alpha; transparent would turn black
    ctx.fillRect(0, 0, size.width, size.height)
  }
  ctx.drawImage(image.source as never, 0, 0, size.width, size.height)
  return { canvas, ctx }
}

const analyse = (ctx: CanvasContextLike, size: { width: number; height: number }) => {
  try {
    const { data } = ctx.getImageData(0, 0, size.width, size.height)
    return { hasAlpha: detectAlpha(data), lineArt: looksLikeLineArt(data) }
  } catch {
    return { hasAlpha: false, lineArt: false } // unreadable (tainted/oversized): treat as a photo
  }
}

interface EncodePlan {
  readonly preferred: MediaMime
  readonly hasAlpha: boolean
  readonly maxBytes: number
}

/**
 * Encodes at one size: preferred format first, then lossy WebP steps down in
 * quality, then JPEG (only for opaque images) when the browser can't write WebP.
 * Returns the first result within `maxBytes`, or null.
 */
const encodeWithin = async (
  deps: PipelineDeps,
  image: DecodedImage,
  size: { width: number; height: number },
  { preferred, hasAlpha, maxBytes }: EncodePlan,
): Promise<{ blob: Blob; mime: MediaMime } | null> => {
  const fits = (blob: Blob | null, want: MediaMime): blob is Blob =>
    blob !== null && blob.type === want && blob.size <= maxBytes
  const { canvas } = render(deps, image, size, false)

  if (preferred === 'image/png') {
    const png = await encode(canvas, 'image/png')
    if (fits(png, 'image/png')) return { blob: png, mime: 'image/png' }
  }
  for (const quality of QUALITIES) {
    const webp = await encode(canvas, 'image/webp', quality)
    // Safari silently falls back to PNG when it cannot write WebP, so check the type.
    if (webp !== null && webp.type !== 'image/webp') break
    if (fits(webp, 'image/webp')) return { blob: webp, mime: 'image/webp' }
  }
  if (hasAlpha) return null
  const flat = render(deps, image, size, true).canvas
  for (const quality of QUALITIES) {
    const jpeg = await encode(flat, 'image/jpeg', quality)
    if (fits(jpeg, 'image/jpeg')) return { blob: jpeg, mime: 'image/jpeg' }
  }
  return null
}

/**
 * Decodes, downsizes (never upscales) and re-encodes an uploaded image. EXIF/GPS
 * and all other metadata are stripped by construction: only decoded pixels are
 * drawn to a fresh canvas and re-encoded.
 */
export const processImage = async (
  file: Blob,
  options: ProcessOptions = {},
  deps: PipelineDeps = browserDeps,
): Promise<ProcessedImage> => {
  const maxEdge = clampMaxEdge(options.maxEdge)
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  await rejectUnsupportedInput(file)

  let image: DecodedImage
  try {
    image = await deps.decode(file)
  } catch (cause) {
    throw new ImagePipelineError(
      'unreadable-format',
      `This browser cannot read that format${file.type ? ` (${file.type})` : ''}. Convert it to PNG or JPEG and try again.`,
      { cause },
    )
  }

  try {
    const first = computeTargetSize(image.width, image.height, maxEdge)
    const { ctx } = render(deps, image, first, false)
    const { hasAlpha, lineArt } = analyse(ctx, first)
    const preferred = chooseOutputFormat(hasAlpha, lineArt)

    let edge = Math.max(image.width, image.height, 1)
    edge = Math.min(edge, maxEdge)
    for (let step = 0; step < MAX_EDGE_STEPS && (step === 0 || edge >= MIN_EDGE); step += 1) {
      const size = computeTargetSize(image.width, image.height, edge)
      const result = await encodeWithin(deps, image, size, { preferred, hasAlpha, maxBytes })
      if (result) return { ...result, width: size.width, height: size.height }
      edge = Math.floor(edge * EDGE_SHRINK)
    }
    throw new ImagePipelineError('too-large', 'The image is too large to store even after shrinking it.')
  } finally {
    image.close()
  }
}
