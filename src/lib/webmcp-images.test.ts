import { describe, expect, it, vi } from 'vitest'
import { type StudyCard, createEmptyAppState } from '../types'
import { TOOL_FACTORIES, type ModelContextTool, type WebMcpDeps, stripImageBytes } from './webmcp'

const SET_ID = '11111111-1111-4111-8111-111111111111'
const dataUrl = `data:image/jpeg;base64,${'A'.repeat(400)}`

const card = {
  id: '33333333-3333-4333-8333-333333333333',
  setId: SET_ID,
  prompt: 'Label it',
  content: {
    kind: 'image-occlusion',
    imageDataUrl: dataUrl,
    occlusions: [{ id: 'r1', xPct: 0, yPct: 0, widthPct: 50, heightPct: 50, label: 'Heart' }],
  },
  explanation: null,
  sourceRef: null,
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  scheduling: { state: 'New', due: '2026-01-01T00:00:00.000Z' },
}
const set = { id: SET_ID, name: 'A', description: '', tags: [], goalDate: null }
const full = { sets: [set], cards: [card] }

const deps = (): WebMcpDeps => ({
  store: {
    state: { ...createEmptyAppState(), sets: [set], cards: [card] },
    exportSet: vi.fn(() => full),
    exportAll: vi.fn(() => full),
  } as never,
  navigate: vi.fn(),
  now: () => new Date('2026-10-03T00:00:00Z'),
})

const tools = (): Record<string, ModelContextTool> =>
  Object.fromEntries(TOOL_FACTORIES.map((make) => make(deps)).map((tool) => [tool.name, tool]))

const text = async (name: string, input: unknown): Promise<string> =>
  (await tools()[name]?.execute(input))?.content[0]?.text ?? ''

describe('image bytes in WebMCP output', () => {
  it('stripImageBytes leaves other content alone and describes images', () => {
    const plain: StudyCard['content'] = { kind: 'short-answer', answer: 'a', acceptableAnswers: [] }
    expect(stripImageBytes(plain)).toBe(plain)
    const stripped = stripImageBytes(card.content as never)
    expect(stripped).not.toHaveProperty('imageDataUrl')
    expect(stripped).toMatchObject({
      kind: 'image-occlusion',
      occlusions: card.content.occlusions,
      image: { hasImage: true, approxBytes: 300, mime: 'image/jpeg' },
    })
  })

  it('list_cards never returns the data URL but keeps the regions', async () => {
    const out = await text('list_cards', { setId: SET_ID })
    expect(out).not.toContain('AAAA')
    expect(out).toContain('"hasImage":true')
    expect(out).toContain('Heart')
  })

  it('export_set and export_all still return the full image data', async () => {
    expect(await text('export_set', { setId: SET_ID })).toContain(dataUrl)
    expect(await text('export_all', {})).toContain(dataUrl)
  })
})
