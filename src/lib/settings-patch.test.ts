import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../types'
import { SETTING_KEYS, parseSettingsPatch } from './settings-patch'

describe('parseSettingsPatch', () => {
  it('returns only the keys present, never defaults', () => {
    expect(parseSettingsPatch({ theme: 'light' })).toEqual({ ok: true, value: { theme: 'light' } })
  })

  it('accepts an empty object as an empty patch', () => {
    expect(parseSettingsPatch({})).toEqual({ ok: true, value: {} })
  })

  it('rejects unknown keys by default and drops them on request', () => {
    expect(parseSettingsPatch({ bogus: 1 }).ok).toBe(false)
    expect(parseSettingsPatch({ theme: 'dark', bogus: 1 }, { unknownKeys: 'ignore' })).toEqual({
      ok: true,
      value: { theme: 'dark' },
    })
    expect(parseSettingsPatch({ toString: 1 }).ok).toBe(false)
  })

  it('rejects wrong types and out-of-range values, naming the key', () => {
    const bad = parseSettingsPatch({ theme: 'neon' })
    expect(!bad.ok && bad.error).toMatch(/^theme: /)
    expect(parseSettingsPatch({ desiredRetention: 5 }).ok).toBe(false)
    expect(parseSettingsPatch({ reducedMotion: 'yes' }).ok).toBe(false)
  })

  it('rejects nested or extra structure inside a value', () => {
    expect(parseSettingsPatch({ theme: { nested: 'dark' } }).ok).toBe(false)
    expect(parseSettingsPatch({ customAccent: ['#000000'] }).ok).toBe(false)
  })

  it('rejects null, arrays and primitives', () => {
    for (const raw of [null, [], [{ theme: 'dark' }], 'dark', 3, undefined]) {
      expect(parseSettingsPatch(raw).ok).toBe(false)
    }
  })

  it('treats an undefined-valued key as absent', () => {
    expect(parseSettingsPatch({ theme: undefined, palette: undefined })).toEqual({ ok: true, value: {} })
    expect(parseSettingsPatch({ theme: undefined, bogus: undefined }).ok).toBe(false)
  })

  it('accepts an explicit null for nullable fields and keeps it', () => {
    expect(parseSettingsPatch({ customAccent: null })).toEqual({ ok: true, value: { customAccent: null } })
  })

  it('covers every default setting key', () => {
    expect([...SETTING_KEYS].sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort())
  })
})

const sources = import.meta.glob<string>(['../**/*.ts', '../**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

describe('settings partial guard', () => {
  it('forbids settingsSchema.partial( outside the helper and tests', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10)
    const offenders = Object.entries(sources)
      .filter(
        ([path, text]) =>
          !/\.test\.tsx?$/.test(path) &&
          !path.endsWith('/settings-patch.ts') &&
          /settingsSchema\s*\.\s*partial\s*\(/.test(text),
      )
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })
})
