import { describe, expect, it, vi } from 'vitest'
import { chooseOutputFormat, clampMaxEdge, computeTargetSize, detectAlpha, looksLikeLineArt } from './image-format'
import { ImagePipelineError, browserDeps, processImage, type CanvasLike, type PipelineDeps } from './image-pipeline'

describe('computeTargetSize', () => {
  it('downsizes the long edge preserving aspect ratio', () => {
    expect(computeTargetSize(4000, 2000, 2048)).toEqual({ width: 2048, height: 1024 })
    expect(computeTargetSize(1000, 3000, 1500)).toEqual({ width: 500, height: 1500 })
  })
  it('never upscales and never returns zero', () => {
    expect(computeTargetSize(100, 50, 2048)).toEqual({ width: 100, height: 50 })
    expect(computeTargetSize(10000, 1, 100)).toEqual({ width: 100, height: 1 })
  })
})

describe('format heuristics', () => {
  it('chooses PNG for alpha or line art and WebP otherwise', () => {
    expect(chooseOutputFormat(true, false)).toBe('image/png')
    expect(chooseOutputFormat(false, true)).toBe('image/png')
    expect(chooseOutputFormat(false, false)).toBe('image/webp')
  })
  it('detects alpha', () => {
    expect(detectAlpha([1, 2, 3, 255, 4, 5, 6, 255])).toBe(false)
    expect(detectAlpha([1, 2, 3, 255, 4, 5, 6, 0])).toBe(true)
  })
  it('separates flat art from photographic noise', () => {
    const flat = new Uint8ClampedArray(4000).fill(255)
    const noisy = Uint8ClampedArray.from({ length: 400_000 }, (_, i) => Math.imul(i + 1, 2654435761) >>> 24)
    expect(looksLikeLineArt(flat)).toBe(true)
    expect(looksLikeLineArt(noisy)).toBe(false)
  })
  it('clamps maxEdge', () => {
    expect(clampMaxEdge(undefined)).toBe(2048)
    expect(clampMaxEdge(Number.NaN)).toBe(2048)
    expect(clampMaxEdge(9999)).toBe(3072)
    expect(clampMaxEdge(0)).toBe(1)
    expect(clampMaxEdge(1500.9)).toBe(1500)
  })
})

interface Harness {
  deps: PipelineDeps
  canvases: CanvasLike[]
  fills: string[]
  close: ReturnType<typeof vi.fn>
}

/** Fake decoder/canvas: `sizeFor(type, quality, width)` decides the encoded byte size. */
const harness = (opts: {
  width: number
  height: number
  alpha?: boolean
  pixel?: (i: number) => number
  sizeFor?: (type: string, quality: number | undefined, width: number) => number
  webp?: boolean
  getImageDataThrows?: boolean
  noContext?: boolean
  decodeFails?: boolean
}): Harness => {
  const canvases: CanvasLike[] = []
  const fills: string[] = []
  const close = vi.fn()
  const deps: PipelineDeps = {
    decode: async () => {
      if (opts.decodeFails) throw new Error('nope')
      return { width: opts.width, height: opts.height, source: {}, close }
    },
    createCanvas: (width, height) => {
      const ctx = {
        fillStyle: '',
        fillRect: () => fills.push(String(ctx.fillStyle)),
        drawImage: () => undefined,
        getImageData: () => {
          if (opts.getImageDataThrows) throw new Error('tainted')
          const data = Uint8ClampedArray.from({ length: 4 * 1024 }, (_, i) =>
            i % 4 === 3 ? (opts.alpha ? 0 : 255) : (opts.pixel?.(i) ?? 255),
          )
          return { data }
        },
      }
      const canvas: CanvasLike = {
        width,
        height,
        getContext: () => (opts.noContext ? null : ctx),
        toBlob: (cb, type = 'image/png', quality) => {
          const actual = type === 'image/webp' && opts.webp === false ? 'image/png' : type
          cb(new Blob([new Uint8Array(opts.sizeFor?.(actual, quality, width) ?? 100)], { type: actual }))
        },
      }
      canvases.push(canvas)
      return canvas
    },
  }
  return { deps, canvases, fills, close }
}

const file = (type = 'image/png', parts: BlobPart[] = ['x']) => new Blob(parts, { type })
const photo = (i: number) => Math.imul(i + 1, 2654435761) >>> 24

describe('processImage', () => {
  it('rejects SVG by mime, by sniffing, and by file name', async () => {
    const h = harness({ width: 10, height: 10 })
    await expect(processImage(file('image/svg+xml'), {}, h.deps)).rejects.toMatchObject({ kind: 'svg-unsupported' })
    await expect(processImage(file('', ['<?xml?><svg xmlns="x"/>']), {}, h.deps)).rejects.toMatchObject({
      kind: 'svg-unsupported',
    })
    const named = Object.assign(file('image/png'), { name: 'drawing.SVG' })
    await expect(processImage(named, {}, h.deps)).rejects.toMatchObject({ kind: 'svg-unsupported' })
  })

  it('rejects non-images and undecodable formats with clear messages', async () => {
    const h = harness({ width: 10, height: 10, decodeFails: true })
    await expect(processImage(file('application/pdf'), {}, h.deps)).rejects.toMatchObject({ kind: 'not-an-image' })
    const err = await processImage(file('image/heic'), {}, h.deps).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ImagePipelineError)
    expect(err).toMatchObject({ kind: 'unreadable-format' })
    expect((err as Error).message).toMatch(/cannot read that format \(image\/heic\)/)
    await expect(processImage(file(''), {}, h.deps)).rejects.toThrow(/cannot read that format\./)
  })

  it('never upscales and encodes photos as WebP', async () => {
    const h = harness({ width: 800, height: 600, pixel: photo })
    const out = await processImage(file(), {}, h.deps)
    expect(out).toMatchObject({ width: 800, height: 600, mime: 'image/webp' })
    expect(out.blob.type).toBe('image/webp')
    expect(h.close).toHaveBeenCalledOnce()
  })

  it('caps the long edge at maxEdge and clamps to 3072', async () => {
    const h = harness({ width: 6000, height: 3000, pixel: photo })
    expect(await processImage(file(), {}, h.deps)).toMatchObject({ width: 2048, height: 1024 })
    expect(await processImage(file(), { maxEdge: 99999 }, h.deps)).toMatchObject({ width: 3072, height: 1536 })
  })

  it('chooses PNG for transparent images and keeps alpha (no white flatten)', async () => {
    const h = harness({ width: 50, height: 50, alpha: true, pixel: photo })
    expect(await processImage(file(), {}, h.deps)).toMatchObject({ mime: 'image/png' })
    expect(h.fills).toEqual([])
  })

  it('chooses PNG for flat line art', async () => {
    const h = harness({ width: 50, height: 50 })
    expect(await processImage(file(), {}, h.deps)).toMatchObject({ mime: 'image/png' })
  })

  it('falls back to flattened JPEG when WebP is silently unsupported (Safari)', async () => {
    const h = harness({ width: 50, height: 50, pixel: photo, webp: false })
    const out = await processImage(file(), {}, h.deps)
    expect(out.mime).toBe('image/jpeg')
    expect(h.fills).toEqual(['white'])
  })

  it('does not fall back to JPEG for transparent images', async () => {
    const h = harness({
      width: 50,
      height: 50,
      alpha: true,
      webp: false,
      sizeFor: (t) => (t === 'image/png' ? 1e9 : 1),
    })
    await expect(processImage(file(), { maxBytes: 1000 }, h.deps)).rejects.toMatchObject({ kind: 'too-large' })
    expect(h.fills).toEqual([])
  })

  it('steps quality down before shrinking', async () => {
    const h = harness({
      width: 1000,
      height: 1000,
      pixel: photo,
      sizeFor: (_t, q) => (q === undefined ? 1e9 : q > 0.8 ? 5000 : q > 0.6 ? 3000 : 1000),
    })
    const out = await processImage(file(), { maxBytes: 3500 }, h.deps)
    expect(out).toMatchObject({ mime: 'image/webp', width: 1000 })
  })

  it('shrinks the edge when quality alone is not enough, and the loop terminates', async () => {
    const h = harness({ width: 2000, height: 1000, pixel: photo, sizeFor: (_t, _q, w) => w * 10 })
    const out = await processImage(file(), { maxBytes: 12_000 }, h.deps)
    expect(out.width).toBeLessThanOrEqual(1200)
    expect(out.blob.size).toBeLessThanOrEqual(12_000)

    const never = harness({ width: 2000, height: 1000, pixel: photo, sizeFor: () => 1e9 })
    await expect(processImage(file(), { maxBytes: 10 }, never.deps)).rejects.toMatchObject({ kind: 'too-large' })
    expect(never.canvases.length).toBeLessThan(40)
    expect(never.close).toHaveBeenCalledOnce()
  })

  it('treats unreadable pixel data as a photo and reports a missing 2d context', async () => {
    const tainted = harness({ width: 20, height: 20, getImageDataThrows: true })
    expect(await processImage(file(), {}, tainted.deps)).toMatchObject({ mime: 'image/webp' })
    const nope = harness({ width: 20, height: 20, noContext: true })
    await expect(processImage(file(), {}, nope.deps)).rejects.toMatchObject({ kind: 'encode-failed' })
  })

  it('browser deps decode with explicit EXIF orientation and build real canvases', async () => {
    const bitmap = { width: 3, height: 4, close: vi.fn() }
    const create = vi.fn().mockResolvedValue(bitmap)
    vi.stubGlobal('createImageBitmap', create)
    try {
      const f = file()
      expect(await browserDeps.decode(f)).toMatchObject({ width: 3, height: 4, source: bitmap })
      expect(create).toHaveBeenCalledWith(f, { imageOrientation: 'from-image' })
    } finally {
      vi.unstubAllGlobals()
    }
    const canvas = browserDeps.createCanvas(7, 9)
    expect([canvas.width, canvas.height]).toEqual([7, 9])
  })
})
