import { describe, expect, it } from 'vitest'
import type { StudyCard } from '../../types'
import { parseSimpleJson, toSimpleJson } from './simple-json'

describe('parseSimpleJson', () => {
  it('parses a bare array of {term, definition}', () => {
    const result = parseSimpleJson(JSON.stringify([{ term: 'A', definition: 'B' }]))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.name).toBeNull()
      expect(result.value.cards).toEqual([
        {
          prompt: 'A',
          content: { kind: 'short-answer', answer: 'B', acceptableAnswers: [] },
          explanation: null,
          sourceRef: null,
          tags: [],
        },
      ])
    }
  })

  it('parses a {name, terms} wrapped object', () => {
    const result = parseSimpleJson(JSON.stringify({ name: 'My Set', terms: [{ term: 'A', definition: 'B' }] }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.name).toBe('My Set')
  })

  it('accepts title as a name alias', () => {
    const result = parseSimpleJson(JSON.stringify({ title: 'My Set', terms: [{ term: 'A', definition: 'B' }] }))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.name).toBe('My Set')
  })

  it('accepts question/answer and front/back key aliases', () => {
    const result = parseSimpleJson(
      JSON.stringify([
        { question: 'A', answer: 'B' },
        { front: 'C', back: 'D' },
      ]),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.cards[0]?.prompt).toBe('A')
      expect(result.value.cards[1]?.prompt).toBe('C')
    }
  })

  it('rejects invalid JSON', () => {
    const result = parseSimpleJson('{not valid')
    expect(result.ok).toBe(false)
  })

  it('rejects JSON that is neither a bare array nor a wrapped object', () => {
    const result = parseSimpleJson(JSON.stringify({ foo: 'bar' }))
    expect(result.ok).toBe(false)
  })

  it('rejects entries missing both term/definition and its aliases', () => {
    const result = parseSimpleJson(JSON.stringify([{ term: 'A' }]))
    expect(result.ok).toBe(false)
  })

  it('rejects an empty array', () => {
    const result = parseSimpleJson(JSON.stringify([]))
    expect(result.ok).toBe(false)
  })
})

describe('toSimpleJson', () => {
  it('serializes cards to term/definition pairs using cardFrontBack', () => {
    const card: StudyCard = {
      id: 'c1' as StudyCard['id'],
      setId: 'd1' as StudyCard['setId'],
      prompt: 'Powerhouse of the cell?',
      content: { kind: 'short-answer', answer: 'Mitochondria', acceptableAnswers: [] },
      explanation: null,
      sourceRef: null,
      tags: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      scheduling: {
        due: '2026-01-01T00:00:00.000Z',
        stability: 0,
        difficulty: 0,
        scheduledDays: 0,
        learningSteps: 0,
        reps: 0,
        lapses: 0,
        state: 'New',
        lastReview: null,
      },
    }

    expect(toSimpleJson('My Set', [card])).toEqual({
      name: 'My Set',
      terms: [{ term: 'Powerhouse of the cell?', definition: 'Mitochondria' }],
    })
  })
})
