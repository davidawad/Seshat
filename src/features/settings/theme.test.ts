import { describe, expect, it } from 'vitest'
import { resolveSizingCssVars, resolveThemeAttribute, resolveTypefaceAttribute } from './theme'

describe('resolveThemeAttribute', () => {
  it('resolves system to null so the media query governs', () => {
    expect(resolveThemeAttribute('system')).toBeNull()
  })

  it('resolves light/dark to themselves', () => {
    expect(resolveThemeAttribute('light')).toBe('light')
    expect(resolveThemeAttribute('dark')).toBe('dark')
  })
})

describe('resolveTypefaceAttribute', () => {
  it('passes the typeface through unchanged', () => {
    expect(resolveTypefaceAttribute('atkinson-hyperlegible')).toBe('atkinson-hyperlegible')
    expect(resolveTypefaceAttribute('source-serif-4')).toBe('source-serif-4')
  })
})

describe('resolveSizingCssVars', () => {
  it('formats pt/unitless/ch values for CSS custom properties', () => {
    expect(resolveSizingCssVars({ bodyFontSizePt: 12.5, lineHeight: 1.45, measureCh: 65 })).toEqual({
      '--font-size-body': '12.5pt',
      '--line-height-body': '1.45',
      '--measure': '65ch',
    })
  })

  it('reflects settings at the boundaries of the allowed ranges', () => {
    expect(resolveSizingCssVars({ bodyFontSizePt: 11.5, lineHeight: 1.4, measureCh: 55 })).toEqual({
      '--font-size-body': '11.5pt',
      '--line-height-body': '1.4',
      '--measure': '55ch',
    })
    expect(resolveSizingCssVars({ bodyFontSizePt: 13, lineHeight: 1.5, measureCh: 75 })).toEqual({
      '--font-size-body': '13pt',
      '--line-height-body': '1.5',
      '--measure': '75ch',
    })
  })
})
