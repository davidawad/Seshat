import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, settingsSchema } from '../../types'
import { gradeAnnouncement, gradeForKey, orientFaces, resolveOptions, undoAnnouncement } from './options'

describe('resolveOptions', () => {
  it('defaults to tracking progress with the term first', () => {
    expect(resolveOptions(DEFAULT_SETTINGS)).toEqual({ trackProgress: true, front: 'term' })
  })

  it('reflects the saved settings', () => {
    const settings = { ...DEFAULT_SETTINGS, flashcardsTrackProgress: false, flashcardsFront: 'definition' as const }
    expect(resolveOptions(settings)).toEqual({ trackProgress: false, front: 'definition' })
  })

  it('old saved settings without the new fields still parse to the defaults', () => {
    const { flashcardsTrackProgress: _a, flashcardsFront: _b, ...old } = DEFAULT_SETTINGS
    const parsed = settingsSchema.parse(old)
    expect(parsed.flashcardsTrackProgress).toBe(true)
    expect(parsed.flashcardsFront).toBe('term')
  })
})

describe('orientFaces', () => {
  const card = { front: 'Term', back: 'Definition' }

  it('keeps the card as-is when the term goes first', () => {
    expect(orientFaces(card, 'term')).toEqual(card)
  })

  it('swaps the faces when the definition goes first', () => {
    expect(orientFaces(card, 'definition')).toEqual({ front: 'Definition', back: 'Term' })
  })
})

describe('gradeForKey', () => {
  const keyFor = (actionId: string) =>
    ({ 'nav.left': 'A', 'nav.right': 'D', 'flashcards.dontKnow': '1', 'flashcards.know': '2' })[actionId] ?? ''
  const press = (key: string) => gradeForKey(new KeyboardEvent('keydown', { key }), keyFor)

  it('maps the nav keys and the 1/2 keys to a grade', () => {
    expect(press('d')).toBe('know')
    expect(press('2')).toBe('know')
    expect(press('a')).toBe('learning')
    expect(press('1')).toBe('learning')
  })

  it('ignores anything else, including arrows once remapped away', () => {
    expect(press('ArrowRight')).toBeNull()
    expect(press('x')).toBeNull()
  })
})

describe('announcements', () => {
  it('names the outcome and the next card', () => {
    expect(gradeAnnouncement(true, 2, 29)).toBe('Marked as known. Card 3 of 29.')
    expect(gradeAnnouncement(false, 2, 29)).toBe('Marked as still learning. Card 3 of 29.')
  })

  it('says the session is complete after the last card', () => {
    expect(gradeAnnouncement(true, 29, 29)).toBe('Marked as known. Session complete.')
  })

  it('announces the card undo returned to', () => {
    expect(undoAnnouncement(1, 29)).toBe('Undid last answer. Card 2 of 29.')
  })
})
