import { describe, expect, it } from 'vitest'
import {
  type Backup,
  BACKUP_VERSION,
  MAX_BACKUP_CHARS,
  applyBackup,
  backupFilename,
  createBackup,
  describeImport,
  migrateEnvelope,
  parseBackup,
} from './backup'
import { createInitialScheduling } from './fsrs'
import {
  type AppState,
  type CardId,
  type SetId,
  type StudyCard,
  type StudySet,
  DEFAULT_SETTINGS,
  cardIdSchema,
  createEmptyAppState,
  setIdSchema,
} from '../types'

const NOW = new Date('2026-10-03T12:00:00.000Z')
const ISO = NOW.toISOString()

const setId = (n: number): SetId => setIdSchema.parse(`00000000-0000-4000-8000-00000000000${n}`)
const cardId = (n: number): CardId => cardIdSchema.parse(`10000000-0000-4000-8000-00000000000${n}`)

const makeSet = (n: number, name = `Set ${n}`): StudySet => ({
  id: setId(n),
  name,
  description: '',
  tags: [],
  createdAt: ISO,
  updatedAt: ISO,
  goalDate: null,
})

const makeCard = (n: number, forSet: number, prompt = `Q${n}`): StudyCard => ({
  id: cardId(n),
  setId: setId(forSet),
  prompt,
  promptImage: null,
  content: { kind: 'short-answer', answer: 'a', acceptableAnswers: [], answerImage: null },
  explanation: null,
  sourceRef: null,
  tags: [],
  createdAt: ISO,
  updatedAt: ISO,
  scheduling: createInitialScheduling(NOW),
})

const makeLog = (n: number, forSet: number) => ({
  cardId: cardId(n),
  setId: setId(forSet),
  reviewedAt: ISO,
  grade: 'good' as const,
  confidence: null,
  correct: true,
  retrievabilityAtReview: 0.9,
  elapsedMs: 1200,
  selfExplanation: null,
})

const state = (): AppState => ({
  ...createEmptyAppState(),
  sets: [makeSet(1), makeSet(2)],
  cards: [makeCard(1, 1), makeCard(2, 1), makeCard(3, 2)],
  reviewLog: [makeLog(1, 1), makeLog(3, 2)],
  settings: { ...DEFAULT_SETTINGS, theme: 'dark' },
})

const serialize = (backup: unknown) => JSON.stringify(backup)

describe('createBackup / parseBackup', () => {
  it('stamps a versioned envelope', () => {
    const backup = createBackup(state(), { 'flashcards.flip': 'Enter' }, NOW)
    expect(backup).toMatchObject({ format: 'seshat-backup', version: BACKUP_VERSION, exportedAt: ISO })
    expect(typeof backup.appVersion).toBe('string')
    expect(backupFilename(NOW)).toBe('seshat-backup-2026-10-03.json')
  })

  it('round-trips state and keybindings exactly', () => {
    const original = state()
    const parsed = parseBackup(serialize(createBackup(original, { 'flashcards.flip': 'Enter' }, NOW)))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.sets).toEqual(original.sets)
    expect(parsed.value.cards).toEqual(original.cards)
    expect(parsed.value.reviewLog).toEqual(original.reviewLog)
    expect(parsed.value.settings).toEqual(original.settings)
    expect(parsed.value.keybindings).toEqual({ 'flashcards.flip': 'Enter' })
  })

  it('layers settings missing from an older backup over defaults', () => {
    const raw = JSON.parse(serialize(createBackup(state(), {}, NOW)))
    raw.settings = { theme: 'dark' }
    const parsed = parseBackup(serialize(raw))
    expect(parsed.ok && parsed.value.settings).toEqual({ ...DEFAULT_SETTINGS, theme: 'dark' })
  })

  it('a theme-only settings patch keeps palette, accent and flashcards options at defaults', () => {
    const raw = JSON.parse(serialize(createBackup(state(), {}, NOW)))
    raw.settings = { theme: 'light' }
    const parsed = parseBackup(serialize(raw))
    expect(parsed.ok && parsed.value.settings).toEqual({ ...DEFAULT_SETTINGS, theme: 'light' })
  })

  it('drops invalid keybinding entries instead of failing the whole backup', () => {
    const raw = JSON.parse(serialize(createBackup(state(), {}, NOW)))
    raw.keybindings = { 'not.an.action': 'x' }
    const parsed = parseBackup(serialize(raw))
    expect(parsed.ok && parsed.value.keybindings).toEqual({})
  })

  const mutate = (change: (raw: Record<string, unknown>) => void): string => {
    const raw = JSON.parse(serialize(createBackup(state(), {}, NOW))) as Record<string, unknown>
    change(raw)
    return serialize(raw)
  }

  it.each([
    ['not JSON', '{nope'],
    ['a JSON array', '[]'],
    ['null', 'null'],
    ['a different JSON shape', '{"hello":"world"}'],
    ['the per-set export format', '{"seshatExportVersion":1,"name":"x","description":"","tags":[],"cards":[]}'],
  ])('rejects %s', (_label, raw) => {
    expect(parseBackup(raw).ok).toBe(false)
  })

  it('rejects unknown top-level fields', () => {
    expect(parseBackup(mutate((raw) => (raw['extra'] = 1))).ok).toBe(false)
  })

  it('rejects unknown settings fields', () => {
    expect(parseBackup(mutate((raw) => (raw['settings'] = { bogusSetting: true }))).ok).toBe(false)
  })

  it('rejects invalid settings values', () => {
    expect(parseBackup(mutate((raw) => (raw['settings'] = { theme: 'neon' }))).ok).toBe(false)
  })

  it('rejects malformed cards and reports where', () => {
    const result = parseBackup(mutate((raw) => (raw['cards'] = [{ id: 'nope' }])))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('cards')
  })

  it('rejects duplicate ids, orphan cards and orphan review history', () => {
    const dupSet = parseBackup(mutate((raw) => (raw['sets'] = [makeSet(1), makeSet(1)])))
    expect(dupSet).toEqual({ ok: false, error: 'This backup contains duplicate set ids.' })
    const dupCard = parseBackup(mutate((raw) => (raw['cards'] = [makeCard(1, 1), makeCard(1, 1)])))
    expect(dupCard).toEqual({ ok: false, error: 'This backup contains duplicate card ids.' })
    const orphanCard = parseBackup(mutate((raw) => (raw['cards'] = [makeCard(1, 9)])))
    expect(orphanCard).toEqual({ ok: false, error: 'This backup has cards that belong to no set.' })
    const orphanLog = parseBackup(mutate((raw) => (raw['reviewLog'] = [makeLog(9, 1)])))
    expect(orphanLog.ok).toBe(false)
    const orphanLogSet = parseBackup(mutate((raw) => (raw['reviewLog'] = [makeLog(1, 9)])))
    expect(orphanLogSet.ok).toBe(false)
  })

  it('rejects oversized input before parsing', () => {
    const result = parseBackup(' '.repeat(MAX_BACKUP_CHARS + 1))
    expect(result).toEqual({ ok: false, error: 'That file is too large to be a Seshat backup.' })
  })

  it('rejects a backup from a newer format version', () => {
    const result = parseBackup(mutate((raw) => (raw['version'] = BACKUP_VERSION + 1)))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('newer version')
  })

  it('rejects a missing or invalid version', () => {
    expect(parseBackup(mutate((raw) => delete raw['version'])).ok).toBe(false)
    expect(parseBackup(mutate((raw) => (raw['version'] = 0))).ok).toBe(false)
    expect(parseBackup(mutate((raw) => (raw['version'] = 1.5))).ok).toBe(false)
  })
})

describe('migrateEnvelope', () => {
  it('passes a current-version envelope through untouched', () => {
    const raw = { version: 2, a: 1 }
    expect(migrateEnvelope(raw)).toEqual({ ok: true, value: raw })
  })

  it('walks the chain one version at a time', () => {
    const migrations = {
      1: (raw: Readonly<Record<string, unknown>>) => ({ ...raw, version: 2, step1: true }),
      2: (raw: Readonly<Record<string, unknown>>) => ({ ...raw, version: 3, step2: true }),
    }
    expect(migrateEnvelope({ version: 1 }, migrations, 3)).toEqual({
      ok: true,
      value: { version: 3, step1: true, step2: true },
    })
    expect(migrateEnvelope({ version: 2 }, migrations, 3)).toEqual({ ok: true, value: { version: 3, step2: true } })
  })

  it('errors when a step is missing from the chain', () => {
    const result = migrateEnvelope({ version: 1 }, {}, 2)
    expect(result).toEqual({ ok: false, error: 'No migration from backup format v1.' })
  })
})

describe('applyBackup', () => {
  const backupOf = (appState: AppState): Backup => createBackup(appState, { 'flashcards.flip': 'Enter' }, NOW)

  it('replace swaps everything, settings and keybindings included', () => {
    const current = { ...createEmptyAppState(), sets: [makeSet(5)] }
    const { state: next, report } = applyBackup(current, backupOf(state()), 'replace')
    expect(next).toEqual(state())
    expect(report).toMatchObject({ mode: 'replace', setsAdded: 2, cardsAdded: 3, reviewsAdded: 2, setsSkipped: 0 })
    expect(report.keybindings).toEqual({ 'flashcards.flip': 'Enter' })
  })

  it('merge adds only missing sets/cards and leaves settings and keybindings alone', () => {
    const current: AppState = {
      ...createEmptyAppState(),
      sets: [makeSet(1, 'Renamed locally')],
      cards: [makeCard(1, 1, 'Edited locally')],
      reviewLog: [],
      settings: { ...DEFAULT_SETTINGS, theme: 'light' },
    }
    const { state: next, report } = applyBackup(current, backupOf(state()), 'merge')
    expect(next.sets.map((set) => set.name)).toEqual(['Renamed locally', 'Set 2'])
    expect(next.cards.map((card) => card.prompt)).toEqual(['Edited locally', 'Q2', 'Q3'])
    expect(next.settings.theme).toBe('light')
    expect(report).toMatchObject({
      mode: 'merge',
      setsAdded: 1,
      setsSkipped: 1,
      cardsAdded: 2,
      cardsSkipped: 1,
      reviewsAdded: 1,
      reviewsSkipped: 1,
      keybindings: null,
    })
  })

  it('merge never overwrites existing review history or scheduling', () => {
    const current = state()
    const advanced: AppState = {
      ...current,
      reviewLog: [...current.reviewLog, { ...makeLog(1, 1), grade: 'again' }],
    }
    const { state: next } = applyBackup(advanced, backupOf(state()), 'merge')
    expect(next.reviewLog).toEqual(advanced.reviewLog)
    expect(next.cards).toEqual(advanced.cards)
  })

  it('merging a backup into itself is a no-op', () => {
    const { state: next, report } = applyBackup(state(), backupOf(state()), 'merge')
    expect(next).toEqual(state())
    expect(report).toMatchObject({ setsAdded: 0, cardsAdded: 0, reviewsAdded: 0, setsSkipped: 2, cardsSkipped: 3 })
  })

  it('adds a brand-new card into an already-present set', () => {
    const bigger = { ...state(), cards: [...state().cards, makeCard(4, 1)] }
    const { state: next, report } = applyBackup(state(), backupOf(bigger), 'merge')
    expect(next.cards).toHaveLength(4)
    expect(report.cardsAdded).toBe(1)
  })
})

describe('describeImport', () => {
  const base = {
    setsAdded: 1,
    setsSkipped: 0,
    cardsAdded: 2,
    cardsSkipped: 1,
    reviewsAdded: 1,
    reviewsSkipped: 0,
    imagesMissing: 0,
    imagesNotConverted: 0,
    keybindings: null,
  }
  it('summarizes replace and merge with correct pluralization', () => {
    expect(describeImport({ ...base, mode: 'replace' })).toBe(
      'Replaced everything with the backup: 1 set, 2 cards and 1 review.',
    )
    expect(describeImport({ ...base, mode: 'merge' })).toBe(
      'Merged 1 set, 2 cards and 1 review from the backup; skipped 0 sets and 1 card already present.',
    )
  })
})
