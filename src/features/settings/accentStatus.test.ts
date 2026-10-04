import { describe, expect, it } from 'vitest'
import { describeAccent } from './accentStatus'

describe('describeAccent', () => {
  it('treats empty as the palette default', () => {
    expect(describeAccent('', { palette: 'archive' }, 'dark')).toEqual({
      message: 'Using the palette’s own accent.',
      valid: true,
    })
  })

  it('rejects malformed hex', () => {
    expect(describeAccent('#12', { palette: 'archive' }, 'dark').valid).toBe(false)
  })

  it('refuses a low-contrast accent with the ratio and the threshold', () => {
    const result = describeAccent('#2a2a2a', { palette: 'archive' }, 'dark')
    expect(result.valid).toBe(false)
    expect(result.message).toMatch(/Not applied.*:1.*at least 3:1/)
  })

  it('accepts a readable accent and mentions button text color', () => {
    const result = describeAccent('#ffd54a', { palette: 'slate' }, 'dark')
    expect(result.valid).toBe(true)
    expect(result.message).toMatch(/applied.*button text is black/)
  })

  it('warns when the accent only works in one mode', () => {
    expect(describeAccent('#ffd54a', { palette: 'slate' }, 'dark').message).toMatch(/only .* in light mode/)
  })
})
