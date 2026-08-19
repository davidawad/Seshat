import { describe, expect, it } from 'vitest'
import {
  KEYBINDING_REGISTRY,
  canonicalizeKeyString,
  describeKeyEvent,
  findBindingConflict,
  findRegistryDefaultCollisions,
  matchesBinding,
  resolveKey,
  resolveKeybindings,
  sanitizeOverrides,
} from './keybindings'

const keyEvent = (
  key: string,
  modifiers: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>> = {},
): KeyboardEvent =>
  ({
    key,
    ctrlKey: modifiers.ctrlKey ?? false,
    metaKey: modifiers.metaKey ?? false,
    altKey: modifiers.altKey ?? false,
    shiftKey: modifiers.shiftKey ?? false,
  }) as KeyboardEvent

describe('KEYBINDING_REGISTRY', () => {
  it('has no duplicate action ids', () => {
    const ids = KEYBINDING_REGISTRY.map((action) => action.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has no two default keys colliding within the same scope', () => {
    expect(findRegistryDefaultCollisions()).toEqual([])
  })
})

describe('describeKeyEvent', () => {
  it('renders a plain digit key as-is', () => {
    expect(describeKeyEvent(keyEvent('1'))).toBe('1')
  })

  it('renders the space key as "Space"', () => {
    expect(describeKeyEvent(keyEvent(' '))).toBe('Space')
  })

  it('uppercases a plain single letter', () => {
    expect(describeKeyEvent(keyEvent('o'))).toBe('O')
  })

  it('passes multi-character named keys through unchanged', () => {
    expect(describeKeyEvent(keyEvent('ArrowRight'))).toBe('ArrowRight')
    expect(describeKeyEvent(keyEvent('Enter'))).toBe('Enter')
  })

  it('prefixes modifiers in a fixed order: Ctrl, Meta, Alt, Shift', () => {
    expect(describeKeyEvent(keyEvent('Enter', { ctrlKey: true }))).toBe('Ctrl+Enter')
    expect(describeKeyEvent(keyEvent('Enter', { ctrlKey: true, metaKey: true, altKey: true, shiftKey: true }))).toBe(
      'Ctrl+Meta+Alt+Shift+Enter',
    )
  })

  it('includes Shift for a plain letter (shift changes its meaning)', () => {
    expect(describeKeyEvent(keyEvent('A', { shiftKey: true }))).toBe('Shift+A')
  })

  it('does not include Shift for a punctuation key that already encodes it', () => {
    // Shift+/ on a US layout delivers key: '?' with shiftKey: true.
    expect(describeKeyEvent(keyEvent('?', { shiftKey: true }))).toBe('?')
  })
})

describe('canonicalizeKeyString', () => {
  it('returns null for an empty or whitespace-only string', () => {
    expect(canonicalizeKeyString('')).toBeNull()
    expect(canonicalizeKeyString('   ')).toBeNull()
  })

  it('canonicalizes a bare key to the same form describeKeyEvent would produce', () => {
    expect(canonicalizeKeyString('1')).toBe('1')
    expect(canonicalizeKeyString('o')).toBe('O')
    expect(canonicalizeKeyString('space')).toBe('Space')
    expect(canonicalizeKeyString('  Space  ')).toBe('Space')
  })

  it('normalizes modifier aliases and casing, in fixed order regardless of input order', () => {
    expect(canonicalizeKeyString('ctrl+enter')).toBe('Ctrl+Enter')
    expect(canonicalizeKeyString('Control+Enter')).toBe('Ctrl+Enter')
    expect(canonicalizeKeyString('shift+ctrl+a')).toBe('Ctrl+Shift+A')
    expect(canonicalizeKeyString('cmd+k')).toBe('Meta+K')
    expect(canonicalizeKeyString('option+k')).toBe('Alt+K')
  })

  it('returns null for an unrecognized modifier token', () => {
    expect(canonicalizeKeyString('super+k')).toBeNull()
  })

  it('round-trips exactly what describeKeyEvent would emit for the same chord', () => {
    expect(canonicalizeKeyString('Ctrl+Enter')).toBe(describeKeyEvent(keyEvent('Enter', { ctrlKey: true })))
  })
})

describe('matchesBinding', () => {
  it('matches when the event canonicalizes to the exact binding string', () => {
    expect(matchesBinding('Space', keyEvent(' '))).toBe(true)
    expect(matchesBinding('Ctrl+Enter', keyEvent('Enter', { ctrlKey: true }))).toBe(true)
  })

  it('does not match a different chord', () => {
    expect(matchesBinding('Space', keyEvent('Enter'))).toBe(false)
    expect(matchesBinding('Ctrl+Enter', keyEvent('Enter'))).toBe(false)
  })

  it('treats Ctrl and Meta as interchangeable, in either direction', () => {
    expect(matchesBinding('Ctrl+Enter', keyEvent('Enter', { metaKey: true }))).toBe(true)
    expect(matchesBinding('Meta+Enter', keyEvent('Enter', { ctrlKey: true }))).toBe(true)
  })

  it('does not let the Ctrl/Meta equivalence mask an unrelated key', () => {
    expect(matchesBinding('Ctrl+Enter', keyEvent('Escape', { metaKey: true }))).toBe(false)
  })
})

describe('resolveKey / resolveKeybindings', () => {
  it('falls back to the registry default when there is no override', () => {
    expect(resolveKey('flashcards.flip', {})).toBe('Space')
  })

  it('prefers a non-empty override over the default', () => {
    expect(resolveKey('flashcards.flip', { 'flashcards.flip': 'Enter' })).toBe('Enter')
  })

  it('treats an empty-string override as absent and falls back to the default', () => {
    expect(resolveKey('flashcards.flip', { 'flashcards.flip': '  ' })).toBe('Space')
  })

  it('returns "" for an unregistered action id', () => {
    expect(resolveKey('nope.notreal', {})).toBe('')
  })

  it('resolves every registered action at once, applying only matching overrides', () => {
    const resolved = resolveKeybindings({ 'flashcards.flip': 'Enter' })
    expect(resolved['flashcards.flip']).toBe('Enter')
    expect(resolved['flashcards.know']).toBe('2')
    expect(Object.keys(resolved)).toHaveLength(KEYBINDING_REGISTRY.length)
  })
})

describe('findBindingConflict', () => {
  const resolved = resolveKeybindings({})

  it('finds another action in the same scope already bound to the candidate key', () => {
    const conflict = findBindingConflict('studyReveal.hard', 'studyReveal', '1', resolved)
    expect(conflict?.id).toBe('studyReveal.again')
  })

  it('returns null when the candidate key is free within the scope', () => {
    expect(findBindingConflict('studyReveal.hard', 'studyReveal', 'Q', resolved)).toBeNull()
  })

  it('ignores same-key matches in a different scope', () => {
    // studyConfidence.guessed and studyReveal.again are both '1' by default,
    // in different scopes — no conflict across scopes.
    expect(findBindingConflict('studyConfidence.guessed', 'studyReveal', '1', resolved)).not.toBeNull()
    // 'test' scope's only action defaults to 'Ctrl+Enter', so plain '1' is unclaimed there.
    expect(findBindingConflict('flashcards.dontKnow', 'test', '1', resolved)).toBeNull()
  })

  it('excludes the action itself from being reported as its own conflict', () => {
    expect(findBindingConflict('studyReveal.again', 'studyReveal', '1', resolved)).toBeNull()
  })
})

describe('sanitizeOverrides', () => {
  it('accepts a well-formed override map', () => {
    const result = sanitizeOverrides({ 'flashcards.flip': 'Enter' })
    expect(result.overrides).toEqual({ 'flashcards.flip': 'Enter' })
    expect(result.ignoredActionIds).toEqual([])
  })

  it('canonicalizes accepted key strings', () => {
    const result = sanitizeOverrides({ 'flashcards.toggleOrder': 'ctrl+shift+o' })
    expect(result.overrides['flashcards.toggleOrder']).toBe('Ctrl+Shift+O')
  })

  it('drops and reports unknown action ids', () => {
    const result = sanitizeOverrides({ 'not.a.real.action': '1' })
    expect(result.overrides).toEqual({})
    expect(result.ignoredActionIds).toContain('not.a.real.action')
  })

  it('drops and reports an unparseable key string', () => {
    const result = sanitizeOverrides({ 'flashcards.flip': 'super+z' })
    expect(result.overrides).toEqual({})
    expect(result.ignoredActionIds).toContain('flashcards.flip')
  })

  it('drops an entry that collides with another action still sitting at its default in the same scope', () => {
    // studyReveal.again stays at its default '1'; studyReveal.hard trying to
    // also claim '1' collides in the final proposed state and is dropped.
    const result = sanitizeOverrides({ 'studyReveal.hard': '1' })
    expect(result.overrides).toEqual({})
    expect(result.ignoredActionIds).toContain('studyReveal.hard')
  })

  it('accepts two actions in the same scope swapping keys with each other', () => {
    // again defaults to '1', hard defaults to '2' — swapping both in one
    // upload must succeed: the final proposed state (again='2', hard='1')
    // has no collision, even though checking either entry in isolation
    // against the OTHER's still-default key would look like one.
    const result = sanitizeOverrides({ 'studyReveal.again': '2', 'studyReveal.hard': '1' })
    expect(result.overrides).toEqual({ 'studyReveal.again': '2', 'studyReveal.hard': '1' })
    expect(result.ignoredActionIds).toEqual([])
  })

  it('drops both sides of a genuine unresolved collision (not a swap) between two uploaded entries', () => {
    // Both again and hard try to claim '3' — good already owns '3' by
    // default and neither entry frees it for the other, so both are dropped
    // rather than picking an arbitrary winner.
    const result = sanitizeOverrides({ 'studyReveal.again': '3', 'studyReveal.hard': '3' })
    expect(result.overrides).toEqual({})
    expect(result.ignoredActionIds).toEqual(expect.arrayContaining(['studyReveal.again', 'studyReveal.hard']))
  })

  it('returns everything empty for a non-object payload', () => {
    expect(sanitizeOverrides('not an object')).toEqual({ overrides: {}, ignoredActionIds: [] })
    expect(sanitizeOverrides(null)).toEqual({ overrides: {}, ignoredActionIds: [] })
    expect(sanitizeOverrides([1, 2, 3])).toEqual({ overrides: {}, ignoredActionIds: [] })
  })

  it('drops and reports a non-string value for a known action id, without failing the whole upload', () => {
    const result = sanitizeOverrides({ 'flashcards.flip': 42, 'flashcards.know': '3' })
    expect(result.overrides).toEqual({ 'flashcards.know': '3' })
    expect(result.ignoredActionIds).toContain('flashcards.flip')
  })
})
