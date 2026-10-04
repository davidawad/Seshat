import type { MediaMime } from './types'

const DEFAULT_MAX_EDGE = 2048
const MAX_ALLOWED_EDGE = 3072
export const DEFAULT_MAX_BYTES = 4 * 1024 * 1024

/** Scales (width, height) so the long edge is at most `maxEdge`; never upscales; never returns 0. */
export const computeTargetSize = (
  width: number,
  height: number,
  maxEdge: number,
): { readonly width: number; readonly height: number } => {
  const longest = Math.max(width, height)
  const scale = longest > maxEdge ? maxEdge / longest : 1
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * Preferred encoding: lossless PNG for transparency and flat line art (WebP
 * lossy smears thin strokes), lossy WebP for photographic content.
 */
export const chooseOutputFormat = (hasAlpha: boolean, isLineArt: boolean): MediaMime =>
  hasAlpha || isLineArt ? 'image/png' : 'image/webp'

/** True if any sampled pixel in RGBA `data` is not fully opaque. */
export const detectAlpha = (data: ArrayLike<number>): boolean => {
  for (let i = 3; i < data.length; i += 4) if ((data[i] ?? 255) < 255) return true
  return false
}

const SAMPLE_PIXELS = 20_000
const LINE_ART_MAX_COLORS = 32

/** Flat diagrams/screenshots use few distinct colours (4 bits per channel); photos use hundreds. */
export const looksLikeLineArt = (data: ArrayLike<number>): boolean => {
  const pixels = Math.floor(data.length / 4)
  const stride = Math.max(1, Math.floor(pixels / SAMPLE_PIXELS))
  const seen = new Set<number>()
  for (let p = 0; p < pixels; p += stride) {
    const i = p * 4
    seen.add((((data[i] ?? 0) >> 4) << 8) | (((data[i + 1] ?? 0) >> 4) << 4) | ((data[i + 2] ?? 0) >> 4))
    if (seen.size > LINE_ART_MAX_COLORS) return false
  }
  return true
}

/** Clamps a requested long-edge to [1, MAX_ALLOWED_EDGE]; non-finite falls back to the default. */
export const clampMaxEdge = (maxEdge: number | undefined): number =>
  maxEdge === undefined || !Number.isFinite(maxEdge)
    ? DEFAULT_MAX_EDGE
    : Math.min(MAX_ALLOWED_EDGE, Math.max(1, Math.floor(maxEdge)))
