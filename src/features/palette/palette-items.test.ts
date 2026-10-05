import { describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import { cardIdSchema, setIdSchema, type StudyCard, type StudySet } from '../../types'
import {
  buildPaletteItems,
  groupPaletteItems,
  isMacPlatform,
  nextTheme,
  paletteKeyHint,
  type PaletteItem,
} from './palette-items'

const now = '2026-01-01T00:00:00.000Z'
const idA = setIdSchema.parse('a1111111-1111-4111-8111-111111111111')
const idB = setIdSchema.parse('b2222222-2222-4222-8222-222222222222')

const makeSet = (id: typeof idA, name: string, tags: string[] = []): StudySet => ({
  id,
  name,
  description: '',
  tags,
  createdAt: now,
  updatedAt: now,
  goalDate: null,
})

const makeCard = (setId: typeof idA, n: number): StudyCard => ({
  id: cardIdSchema.parse(`c${n}111111-1111-4111-8111-111111111111`),
  setId,
  prompt: `p${n}`,
  promptImage: null,
  content: { kind: 'short-answer', answer: 'a', acceptableAnswers: [], answerImage: null },
  explanation: null,
  sourceRef: null,
  tags: [],
  createdAt: now,
  updatedAt: now,
  scheduling: createInitialScheduling(new Date(now)),
})

const labels = (items: readonly PaletteItem[]) => items.map((item) => item.label)

describe('buildPaletteItems', () => {
  const none = buildPaletteItems([], [], 'system')

  it('always lists every page and action, even with no sets', () => {
    expect(labels(none)).toEqual([
      'Home',
      'Sets',
      'Create a set',
      'Import a set',
      'Stats',
      'About',
      'Docs',
      'Release notes',
      'Attributions',
      'License',
      'Open Settings',
      'Keyboard shortcuts',
      'Toggle theme',
      'Export a backup',
    ])
  })

  it('points each page at its route', () => {
    const route = (label: string) => none.find((item) => item.label === label)?.target
    expect(route('Create a set')).toEqual({ kind: 'route', to: '/sets/new' })
    expect(route('Import a set')).toEqual({ kind: 'route', to: '/sets/import' })
    expect(route('License')).toEqual({ kind: 'route', to: '/licensing' })
  })

  it('gives sensible keywords: new for create, preferences for settings', () => {
    const kw = (label: string) => none.find((item) => item.label === label)?.keywords ?? []
    expect(kw('Create a set')).toContain('new')
    expect(kw('Open Settings')).toContain('preferences')
  })

  it('shows the current theme as the toggle hint', () => {
    expect(buildPaletteItems([], [], 'dark').find((item) => item.label === 'Toggle theme')?.hint).toBe('dark')
  })

  it('adds open, study, learn and flashcards entries for a set with cards, with a card-count hint', () => {
    const items = buildPaletteItems([makeSet(idA, 'Capitals', ['geo'])], [makeCard(idA, 1), makeCard(idA, 2)], 'system')
    const sets = items.filter((item) => item.group === 'Your sets')
    expect(labels(sets)).toEqual(['Capitals', 'Study Capitals', 'Learn Capitals', 'Flashcards Capitals'])
    expect(sets[0]?.hint).toBe('2 cards')
    expect(sets.map((item) => item.target)).toEqual([
      { kind: 'route', to: `/sets/${idA}` },
      { kind: 'route', to: `/sets/${idA}/study` },
      { kind: 'route', to: `/sets/${idA}/learn` },
      { kind: 'route', to: `/sets/${idA}/flashcards` },
    ])
    expect(sets[1]?.keywords).toContain('geo')
  })

  it('hides Study, Learn and Flashcards for an empty set and singularizes the hint', () => {
    const items = buildPaletteItems([makeSet(idA, 'Empty'), makeSet(idB, 'One')], [makeCard(idB, 1)], 'system')
    const sets = items.filter((item) => item.group === 'Your sets')
    expect(labels(sets)).toEqual(['Empty', 'One', 'Study One', 'Learn One', 'Flashcards One'])
    expect(sets[0]?.hint).toBe('0 cards')
    expect(sets[1]?.hint).toBe('1 card')
  })

  it('keeps labels unique when two sets share a name', () => {
    const items = buildPaletteItems([makeSet(idA, 'Dupe'), makeSet(idB, 'Dupe')], [], 'system')
    expect(labels(items.filter((item) => item.group === 'Your sets'))).toEqual(['Dupe', 'Dupe (2)'])
    expect(new Set(labels(items)).size).toBe(items.length)
  })

  it('has globally unique ids', () => {
    const items = buildPaletteItems([makeSet(idA, 'A')], [makeCard(idA, 1)], 'system')
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length)
  })
})

describe('groupPaletteItems', () => {
  it('orders Pages, Actions, Your sets and drops empty groups', () => {
    expect(groupPaletteItems(buildPaletteItems([], [], 'system')).map((entry) => entry.group)).toEqual([
      'Pages',
      'Actions',
    ])
    const withSet = buildPaletteItems([makeSet(idA, 'A')], [], 'system')
    expect(groupPaletteItems(withSet).map((entry) => entry.group)).toEqual(['Pages', 'Actions', 'Your sets'])
  })
})

describe('nextTheme', () => {
  it('cycles system, light, dark, system', () => {
    expect(nextTheme('system')).toBe('light')
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('system')
  })
})

describe('paletteKeyHint', () => {
  it('shows the Command glyph on Apple platforms and the binding elsewhere', () => {
    expect(paletteKeyHint('Ctrl+K', true)).toBe('⌘K')
    expect(paletteKeyHint('Ctrl+K', false)).toBe('Ctrl+K')
    expect(paletteKeyHint('Alt+P', true)).toBe('Alt+P')
  })

  it('detects the platform without throwing', () => {
    expect(typeof isMacPlatform()).toBe('boolean')
  })
})
