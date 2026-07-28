import { describe, expect, it } from 'vitest'
import {
  IMAGE_SIZE_WARNING_BYTES,
  computeScaledDimensions,
  estimateDataUrlBytes,
  isImageDataUrlOversized,
} from './image-processing'

describe('computeScaledDimensions', () => {
  it('leaves an image untouched when already within the cap', () => {
    expect(computeScaledDimensions(800, 600, 1200)).toEqual({ width: 800, height: 600 })
  })

  it('downscales a landscape image so its longest edge matches the cap', () => {
    expect(computeScaledDimensions(4000, 2000, 1200)).toEqual({ width: 1200, height: 600 })
  })

  it('downscales a portrait image so its longest edge matches the cap', () => {
    expect(computeScaledDimensions(2000, 4000, 1200)).toEqual({ width: 600, height: 1200 })
  })

  it('never upscales a smaller image', () => {
    expect(computeScaledDimensions(300, 200, 1200)).toEqual({ width: 300, height: 200 })
  })

  it('never produces a zero-size dimension', () => {
    const { width, height } = computeScaledDimensions(1, 10000, 1200)
    expect(width).toBeGreaterThanOrEqual(1)
    expect(height).toBeGreaterThanOrEqual(1)
  })
})

describe('estimateDataUrlBytes', () => {
  it('estimates the byte size of the base64 payload, ignoring the data: prefix', () => {
    // 'aGVsbG8=' is base64 for 'hello' (5 bytes)
    expect(estimateDataUrlBytes('data:text/plain;base64,aGVsbG8=')).toBe(5)
  })

  it('handles a payload with no padding', () => {
    // 'aGVsbG8' padded differs; use an exact-multiple-of-3 example: 'Zm9vYmFy' = 'foobar' (6 bytes)
    expect(estimateDataUrlBytes('data:text/plain;base64,Zm9vYmFy')).toBe(6)
  })

  it('returns 0 for an empty payload', () => {
    expect(estimateDataUrlBytes('data:image/jpeg;base64,')).toBe(0)
  })
})

describe('isImageDataUrlOversized', () => {
  it('is false for a small payload', () => {
    expect(isImageDataUrlOversized('data:text/plain;base64,aGVsbG8=')).toBe(false)
  })

  it('is true once the estimated size exceeds the warning threshold', () => {
    // Build a base64 payload long enough to exceed IMAGE_SIZE_WARNING_BYTES.
    // base64 length ~= bytes * 4/3, so pad well past the threshold.
    const bytesNeeded = IMAGE_SIZE_WARNING_BYTES + 1024
    const base64Length = Math.ceil((bytesNeeded * 4) / 3 / 4) * 4
    const oversized = `data:image/jpeg;base64,${'A'.repeat(base64Length)}`
    expect(isImageDataUrlOversized(oversized)).toBe(true)
  })
})
