import { beforeEach, describe, expect, it } from 'vitest'
import {
  DRAFT_STORAGE_KEY,
  type SetDraft,
  clearDraft,
  draftToExportedSet,
  emptyDraft,
  isDraftEmpty,
  loadDraft,
  parseDraft,
  rowsToCards,
  saveDraft,
  serializeDraft,
} from './set-draft'

const draftWith = (overrides: Partial<SetDraft>): SetDraft => ({ ...emptyDraft(), ...overrides })
const row = (id: string, term: string, definition: string) => ({
  id,
  term,
  definition,
  termImage: null,
  definitionImage: null,
})
const ref = {
  id: 'a'.repeat(64),
  mime: 'image/png' as const,
  width: 4,
  height: 3,
  bytes: 9,
  alt: 'x',
  decorative: false,
}

describe('emptyDraft / isDraftEmpty', () => {
  it('starts with two empty rows and counts as empty', () => {
    const draft = emptyDraft()
    expect(draft.rows).toHaveLength(2)
    expect(new Set(draft.rows.map((r) => r.id)).size).toBe(2)
    expect(isDraftEmpty(draft)).toBe(true)
  })

  it('whitespace only is still empty; any content is not', () => {
    expect(isDraftEmpty(draftWith({ title: '   ' }))).toBe(true)
    expect(isDraftEmpty(draftWith({ title: 'x' }))).toBe(false)
    expect(isDraftEmpty(draftWith({ description: 'x' }))).toBe(false)
    expect(isDraftEmpty(draftWith({ tags: 'x' }))).toBe(false)
    expect(isDraftEmpty(draftWith({ rows: [row('a', '', 'def')] }))).toBe(false)
  })
})

describe('parseDraft / serializeDraft', () => {
  it('round-trips', () => {
    const draft = draftWith({ title: 'T', rows: [row('a', 'q', 'a')] })
    expect(parseDraft(serializeDraft(draft))).toEqual(draft)
  })

  it.each([null, '', 'not json', '[]', '{"title":1}', '{"title":"","description":"","tags":"","rows":[]}'])(
    'returns null for %j',
    (raw) => {
      expect(parseDraft(raw)).toBeNull()
    },
  )

  it('regenerates duplicate row ids', () => {
    const raw = JSON.stringify({
      title: '',
      description: '',
      tags: '',
      rows: [row('a', '1', '2'), row('a', '3', '4')],
    })
    const parsed = parseDraft(raw)
    expect(parsed?.rows[0]?.id).toBe('a')
    expect(parsed?.rows[1]?.id).not.toBe('a')
    expect(parsed?.rows[1]?.term).toBe('3')
  })
})

describe('draft storage', () => {
  beforeEach(() => window.localStorage.clear())

  it('saves a non-empty draft, loads it back and clears it', () => {
    const draft = draftWith({ title: 'Kept' })
    expect(saveDraft(draft)).toBe(true)
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).not.toBeNull()
    expect(loadDraft()?.title).toBe('Kept')
    clearDraft()
    expect(loadDraft()).toBeNull()
  })

  it('saving an empty draft removes the key', () => {
    saveDraft(draftWith({ title: 'x' }))
    saveDraft(emptyDraft())
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull()
  })

  it('swallows storage errors', () => {
    const boom = () => {
      throw new Error('denied')
    }
    expect(saveDraft(draftWith({ title: 'x' }), { setItem: boom, removeItem: boom })).toBe(false)
    expect(loadDraft({ getItem: boom })).toBeNull()
    expect(() => clearDraft({ removeItem: boom })).not.toThrow()
  })
})

describe('rowsToCards', () => {
  it('skips blank rows, trims, and reports one-sided rows (1-based)', () => {
    const result = rowsToCards([
      row('a', ' term ', ' def '),
      row('b', '', ''),
      row('c', 'only term', '  '),
      row('d', '', 'only def'),
    ])
    expect(result.cards).toEqual([
      {
        prompt: 'term',
        promptImage: null,
        content: { kind: 'short-answer', answer: 'def', acceptableAnswers: [], answerImage: null },
        explanation: null,
        sourceRef: null,
        tags: [],
      },
    ])
    expect(result.incompleteRows).toEqual([3, 4])
  })
})

describe('draftToExportedSet', () => {
  it('builds a set with parsed tags and trimmed fields', () => {
    const result = draftToExportedSet(
      draftWith({ title: ' Name ', description: ' d ', tags: 'a, b,a', rows: [row('a', 'q', 'x'), row('b', '', '')] }),
    )
    expect(result).toMatchObject({ ok: true, value: { name: 'Name', description: 'd', tags: ['a', 'b'] } })
    if (result.ok) expect(result.value.cards).toHaveLength(1)
  })

  it('reports a missing title', () => {
    expect(draftToExportedSet(draftWith({ rows: [row('a', 'q', 'x')] }))).toEqual({
      ok: false,
      error: { titleMissing: true, incompleteRows: [], noCards: false },
    })
  })

  it('reports one-sided rows and a lack of cards', () => {
    expect(draftToExportedSet(draftWith({ title: 'T', rows: [row('a', 'q', '')] }))).toEqual({
      ok: false,
      error: { titleMissing: false, incompleteRows: [1], noCards: false },
    })
    expect(draftToExportedSet(draftWith({ title: 'T' }))).toEqual({
      ok: false,
      error: { titleMissing: false, incompleteRows: [], noCards: true },
    })
  })
})

describe('row images', () => {
  it('carry through to the exported cards as promptImage / answerImage', () => {
    const { cards } = rowsToCards([{ ...row('a', 'q', 'a'), termImage: ref, definitionImage: ref }])
    expect(cards[0]?.promptImage).toEqual(ref)
    expect(cards[0]?.content).toMatchObject({ kind: 'short-answer', answerImage: ref })
  })

  it('round-trip through the stored draft, and older drafts without image fields still parse', () => {
    const draft = draftWith({ title: 'T', rows: [{ ...row('a', 'q', 'a'), termImage: ref }] })
    expect(parseDraft(serializeDraft(draft))).toEqual(draft)
    const legacy = JSON.stringify({
      title: '',
      description: '',
      tags: '',
      rows: [{ id: 'a', term: 'q', definition: 'a' }],
    })
    expect(parseDraft(legacy)?.rows[0]).toEqual(row('a', 'q', 'a'))
  })
})
