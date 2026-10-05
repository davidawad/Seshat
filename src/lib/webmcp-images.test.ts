import { createMemoryMediaStore } from './media/store'
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
  media: createMemoryMediaStore(),
  navigate: vi.fn(),
  now: () => new Date('2026-10-03T00:00:00Z'),
})

const tools = (): Record<string, ModelContextTool> =>
  Object.fromEntries(TOOL_FACTORIES.map((make) => make(deps)).map((tool) => [tool.name, tool]))

const text = async (name: string, input: unknown): Promise<string> =>
  (await tools()[name]?.execute(input))?.content[0]?.text ?? ''

describe('image bytes in WebMCP output', () => {
  it('stripImageBytes leaves other content alone and describes images', () => {
    const plain: StudyCard['content'] = { kind: 'short-answer', answer: 'a', acceptableAnswers: [], answerImage: null }
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

  const ref = {
    id: 'a'.repeat(64),
    mime: 'image/png' as const,
    width: 10,
    height: 20,
    bytes: 99,
    alt: 'a heart',
    decorative: false,
  }

  it('summarises MediaRefs as {id, alt, width, height} (never bytes) for every image slot', () => {
    const occ = { kind: 'image-occlusion', image: ref, occlusions: card.content.occlusions } as never
    expect(stripImageBytes(occ)).toMatchObject({ image: { id: ref.id, alt: 'a heart', width: 10, height: 20 } })
    expect(JSON.stringify(stripImageBytes(occ))).not.toContain('bytes')
    const noImage = { kind: 'image-occlusion', image: null, occlusions: card.content.occlusions } as never
    expect(stripImageBytes(noImage)).toMatchObject({ image: null })
    const answer: StudyCard['content'] = { kind: 'short-answer', answer: 'a', acceptableAnswers: [], answerImage: ref }
    expect(stripImageBytes(answer)).toMatchObject({ answerImage: { id: ref.id, width: 10, height: 20 } })
  })

  it('list_cards shows promptImage as a summary', async () => {
    const withPrompt = { ...card, promptImage: ref, content: { kind: 'cloze', text: 'x {{y}}' } }
    const d = deps()
    d.store.state.cards = [withPrompt as never]
    const tool = TOOL_FACTORIES.map((make) => make(() => d)).find((t) => t.name === 'list_cards')
    const out = (await tool?.execute({ setId: SET_ID }))?.content[0]?.text ?? ''
    expect(out).toContain('"promptImage":{"id":"' + ref.id + '"')
  })

  it('export_set embeds the stored images as base64 media', async () => {
    const store = createMemoryMediaStore()
    const stored = await store.put(new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' }), {
      width: 2,
      height: 2,
    })
    const withImage = { ...card, promptImage: stored, content: { kind: 'cloze', text: 'x {{y}}' } }
    const d = { ...deps(), media: store }
    d.store.state.cards = [withImage as never]
    ;(d.store.exportSet as ReturnType<typeof vi.fn>).mockReturnValue({ cards: [withImage] })
    const tool = TOOL_FACTORIES.map((make) => make(() => d)).find((t) => t.name === 'export_set')
    const out = JSON.parse((await tool?.execute({ setId: SET_ID }))?.content[0]?.text ?? '{}') as {
      media: Record<string, { dataBase64: string }>
    }
    expect(out.media[stored.id]?.dataBase64).toBe('AQIDBA==')
  })
})
