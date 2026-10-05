import { describe, expect, it } from 'vitest'
import type { CardId, ImageOcclusionContent, SetId, StudyCard } from '../types'
import { askedRegion, describePosition, diagramAlt, groupDiagramCards, maskedRegionIds } from './diagram'
import { createInitialScheduling } from './fsrs'

const content = (extra: Partial<ImageOcclusionContent> = {}): ImageOcclusionContent => ({
  kind: 'image-occlusion',
  image: null,
  imageDataUrl: 'data:image/png;base64,AAAA',
  occlusions: [
    { id: 'r1', xPct: 0, yPct: 0, widthPct: 10, heightPct: 10, label: 'One' },
    { id: 'r2', xPct: 80, yPct: 80, widthPct: 10, heightPct: 10, label: 'Two' },
  ],
  ...extra,
})

const card = (id: string, c: StudyCard['content']): StudyCard => ({
  id: id as CardId,
  setId: 's' as SetId,
  prompt: 'p',
  promptImage: null,
  content: c,
  explanation: null,
  sourceRef: null,
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  scheduling: createInitialScheduling(new Date()),
})

describe('askedRegion', () => {
  it('prefers the override, then the card own region, then the first', () => {
    expect(askedRegion(content()).id).toBe('r1')
    expect(askedRegion(content({ askedRegionId: 'r2' })).id).toBe('r2')
    expect(askedRegion(content({ askedRegionId: 'r2' }), 'r1').id).toBe('r1')
  })

  it('falls back when an id names no region', () => {
    expect(askedRegion(content({ askedRegionId: 'gone' }), 'nope').id).toBe('r1')
  })
})

describe('maskedRegionIds', () => {
  const regions = content().occlusions
  it('masks only the asked region by default', () => {
    expect([...maskedRegionIds(regions, 'r2', false)]).toEqual(['r2'])
  })
  it('masks every region with hide-all', () => {
    expect([...maskedRegionIds(regions, 'r2', true)].sort()).toEqual(['r1', 'r2'])
  })
})

describe('describePosition', () => {
  it('names the third of the image the region centre is in', () => {
    expect(describePosition({ xPct: 0, yPct: 0, widthPct: 10, heightPct: 10 })).toBe('upper left')
    expect(describePosition({ xPct: 45, yPct: 45, widthPct: 10, heightPct: 10 })).toBe('centre')
    expect(describePosition({ xPct: 85, yPct: 45, widthPct: 10, heightPct: 10 })).toBe('right')
    expect(describePosition({ xPct: 45, yPct: 85, widthPct: 10, heightPct: 10 })).toBe('lower')
    expect(describePosition({ xPct: 85, yPct: 85, widthPct: 10, heightPct: 10 })).toBe('lower right')
  })
})

describe('diagramAlt', () => {
  it('uses the author alt text, else a name from the prompt', () => {
    expect(diagramAlt('  A heart  ', 'Heart')).toBe('A heart')
    expect(diagramAlt('', 'Heart')).toBe('Diagram for: Heart')
    expect(diagramAlt(undefined, ' ')).toBe('Diagram')
  })
})

describe('groupDiagramCards', () => {
  it('groups cards sharing a diagramId, keeps legacy and other cards separate, in order', () => {
    const short = card('s1', { kind: 'short-answer', answer: 'a', acceptableAnswers: [], answerImage: null })
    const a1 = card('a1', content({ diagramId: 'D', askedRegionId: 'r1' }))
    const a2 = card('a2', content({ diagramId: 'D', askedRegionId: 'r2' }))
    const legacy = card('l1', content())
    const entries = groupDiagramCards([a1, short, a2, legacy])
    expect(entries.map((e) => e.kind)).toEqual(['diagram', 'card', 'diagram'])
    expect(entries[0]).toMatchObject({ kind: 'diagram', key: 'D', cards: [a1, a2] })
    expect(entries[2]).toMatchObject({ kind: 'diagram', cards: [legacy] })
  })
})
