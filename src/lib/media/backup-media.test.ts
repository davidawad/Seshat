import { describe, expect, it } from 'vitest'
import {
  MAX_BACKUP_CHARS,
  MAX_BACKUP_WITH_MEDIA_CHARS,
  MIGRATIONS,
  applyBackup,
  attachBackupMedia,
  buildBackupBlob,
  createBackup,
  describeImport,
  migrateEnvelope,
  parseBackup,
} from '../backup'
import { type ExportedSet, exportedSetSchema } from '../../types'
import { loadMediaMap, toJsonBlobWithMedia } from './export'
import { prepareCardsForImport } from './import-prepare'
import { collectMediaRefs } from './refs'
import { createMemoryMediaStore } from './store'
import { dataUrlOf, identityProcess, nodeBlob, occlusionCard, pngBytes, stateWith, textCard } from './test-helpers'

const readText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsText(blob)
  })

const fresh = () => ({ store: createMemoryMediaStore(), process: identityProcess })

/** A v1 backup file exactly as the previous app version wrote it (images inline). */
const v1BackupFile = (): string => {
  const state = stateWith([
    textCard(1),
    occlusionCard(2, dataUrlOf(pngBytes(1))),
    occlusionCard(3, dataUrlOf(pngBytes(2))),
  ])
  const { media: _media, ...rest } = createBackup(state, {}, new Date('2026-10-03T00:00:00Z'))
  return JSON.stringify({ ...rest, version: 1 })
}

describe('backup v1 -> v2', () => {
  it('registers a v1 migration that adds an empty media map and bumps the version', () => {
    expect(Object.keys(MIGRATIONS)).toEqual(['1'])
    expect(migrateEnvelope({ version: 1, a: 1 })).toEqual({ ok: true, value: { version: 2, a: 1, media: {} } })
  })

  it('parses a v1 file (embedded data URLs) and ingests the images into the store on import', async () => {
    const parsed = parseBackup(v1BackupFile())
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.media).toEqual({})
    const d = fresh()
    const prepared = await prepareCardsForImport(parsed.value.cards, parsed.value.media, d)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.value.notConverted).toBe(0)
    expect((await d.store.list()).length).toBe(2)
    const result = applyBackup(stateWith([]), { ...parsed.value, cards: prepared.value.cards }, 'replace')
    for (const card of result.state.cards) {
      if (card.content.kind !== 'image-occlusion') continue
      expect(card.content.imageDataUrl).toBeUndefined()
      expect(await d.store.has(card.content.image?.id ?? '')).toBe(true)
    }
  })

  it('a v1 image that cannot be converted keeps its data URL and is reported', async () => {
    const state = stateWith([occlusionCard(1, 'data:image/png;base64,@@@')])
    const { media: _m, ...rest } = createBackup(state, {}, new Date())
    const parsed = parseBackup(JSON.stringify({ ...rest, version: 1 }))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const prepared = await prepareCardsForImport(parsed.value.cards, parsed.value.media, fresh())
    expect(prepared.ok && prepared.value.notConverted).toBe(1)
    expect(prepared.ok && prepared.value.cards[0]?.content).toMatchObject({ imageDataUrl: 'data:image/png;base64,@@@' })
  })
})

describe('backup v2 round trip with media', () => {
  const setup = async () => {
    const source = fresh()
    const refA = await source.store.put(nodeBlob(pngBytes(1)), { width: 7, height: 8, alt: 'diagram' })
    const refB = await source.store.put(nodeBlob(pngBytes(2), 'image/webp'), { width: 3, height: 4 })
    const cards = [
      { ...textCard(1), promptImage: refA },
      {
        ...textCard(2),
        content: { kind: 'short-answer' as const, answer: 'x', acceptableAnswers: [], answerImage: refB },
      },
      { ...occlusionCard(3, 'x'), content: { ...occlusionCard(3, 'x').content, imageDataUrl: undefined, image: refA } },
    ]
    return { source, refA, refB, state: stateWith(cards as never) }
  }

  it('export streams images in as Blob parts, and import restores them byte-for-byte into another store', async () => {
    const { source, refA, state } = await setup()
    const backup = createBackup(state, { 'flashcards.undo': 'Z' }, new Date())
    const { value: blob, missing } = await buildBackupBlob(backup, source.store)
    expect(missing).toEqual([])
    const text = await readText(blob)
    const json = JSON.parse(text) as { version: number; media: Record<string, { mime: string }> }
    expect(json.version).toBe(2)
    expect(Object.keys(json.media).sort()).toEqual([...collectMediaRefs(state.cards).keys()].sort())
    expect(json.media[refA.id]?.mime).toBe('image/png')

    const parsed = parseBackup(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const target = fresh()
    const prepared = await prepareCardsForImport(parsed.value.cards, parsed.value.media, target)
    expect(prepared.ok && prepared.value.missing).toBe(0)
    for (const id of Object.keys(json.media)) {
      expect(await target.store.has(id)).toBe(true)
      expect((await target.store.get(id))?.size).toBe((await source.store.get(id))?.size)
    }
    const applied = applyBackup(stateWith([]), { ...parsed.value, media: {} }, 'replace')
    expect(applied.state.cards).toHaveLength(3)
  })

  it('merge keeps existing data and still brings the images', async () => {
    const { source, state } = await setup()
    const { value } = await attachBackupMedia(createBackup(state, {}, new Date()), source.store)
    const parsed = parseBackup(JSON.stringify(value))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const current = stateWith([textCard(77)])
    const target = fresh()
    const prepared = await prepareCardsForImport(parsed.value.cards, parsed.value.media, target)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const merged = applyBackup(current, { ...parsed.value, cards: prepared.value.cards, media: {} }, 'merge')
    expect(merged.state.cards.map((c) => c.prompt)).toContain('Q77')
    expect(merged.report.cardsAdded).toBe(3)
  })

  it('reports blobs the store no longer has, without failing the export', async () => {
    const { source, state } = await setup()
    const [first] = [...collectMediaRefs(state.cards).keys()]
    await source.store.delete(first ?? '')
    const { value, missing } = await attachBackupMedia(createBackup(state, {}, new Date()), source.store)
    expect(missing).toEqual([first])
    expect(Object.keys(value.media)).not.toContain(first)
    const viaBlob = await buildBackupBlob(createBackup(state, {}, new Date()), source.store)
    expect(viaBlob.missing).toEqual([first])
    expect(JSON.parse(await readText(viaBlob.value))).toHaveProperty('media')
  })

  it('with no images the blob is still a valid backup with an empty media map', async () => {
    const { value } = await buildBackupBlob(
      createBackup(stateWith([textCard(1)]), {}, new Date()),
      createMemoryMediaStore(),
    )
    const parsed = parseBackup(await readText(value))
    expect(parsed.ok && parsed.value.media).toEqual({})
  })

  it('strict rules stay: unknown envelope keys, media nobody uses, bad media entries and bad ids are rejected', async () => {
    const { source, state } = await setup()
    const { value } = await attachBackupMedia(createBackup(state, {}, new Date()), source.store)
    const withExtra = { ...value, extra: 1 }
    expect(parseBackup(JSON.stringify(withExtra)).ok).toBe(false)
    const unused = { ...value, media: { ...value.media, ['e'.repeat(64)]: Object.values(value.media)[0] } }
    expect(parseBackup(JSON.stringify(unused))).toMatchObject({ ok: false })
    const badEntry = { ...value, media: { ...value.media, ['d'.repeat(64)]: { mime: 'image/gif' } } }
    expect(parseBackup(JSON.stringify(badEntry)).ok).toBe(false)
    const badId = { ...value, media: { nothex: Object.values(value.media)[0] } }
    expect(parseBackup(JSON.stringify(badId)).ok).toBe(false)
    const dupCards = { ...value, cards: [value.cards[0], value.cards[0]] }
    expect(parseBackup(JSON.stringify(dupCards)).ok).toBe(false)
    const orphanCard = { ...value, sets: [] }
    expect(parseBackup(JSON.stringify(orphanCard)).ok).toBe(false)
  })
})

describe('size-aware cap', () => {
  const pad = (n: number) => 'x'.repeat(n)

  it('rejects a big file with no media, accepts the same size when it declares media, and has a hard ceiling', () => {
    const big = `{"format":"seshat-backup","version":2,"pad":"${pad(MAX_BACKUP_CHARS)}"}`
    expect(parseBackup(big)).toEqual({ ok: false, error: 'That file is too large to be a Seshat backup.' })
    const declares = `{"format":"seshat-backup","version":2,"media":{"${'a'.repeat(64)}":{}},"pad":"${pad(MAX_BACKUP_CHARS)}"}`
    const result = parseBackup(declares)
    expect(result.ok === false && result.error).not.toBe('That file is too large to be a Seshat backup.')
    const huge = `{"format":"seshat-backup","media":{"a":{}},"pad":"${pad(MAX_BACKUP_WITH_MEDIA_CHARS)}"}`
    expect(parseBackup(huge)).toEqual({ ok: false, error: 'That file is too large to be a Seshat backup.' })
    expect(MAX_BACKUP_WITH_MEDIA_CHARS).toBeGreaterThan(MAX_BACKUP_CHARS)
  })
})

describe('describeImport mentions image problems', () => {
  const report = {
    mode: 'replace' as const,
    setsAdded: 1,
    setsSkipped: 0,
    cardsAdded: 1,
    cardsSkipped: 0,
    reviewsAdded: 0,
    reviewsSkipped: 0,
    imagesMissing: 2,
    imagesNotConverted: 1,
    keybindings: null,
  }
  it('adds the notes only when there is something to say', () => {
    expect(describeImport(report)).toContain('2 images could not be restored')
    expect(describeImport(report)).toContain('1 image kept in the old inline format')
    expect(describeImport({ ...report, imagesMissing: 0, imagesNotConverted: 0 })).toBe(
      'Replaced everything with the backup: 1 set, 1 card and 0 reviews.',
    )
    expect(describeImport({ ...report, mode: 'merge', imagesMissing: 1, imagesNotConverted: 0 })).toContain(
      '1 image could not be restored',
    )
  })
})

describe('per-set export with media', () => {
  it('embeds media, round-trips through the strict export schema, and still accepts a v1-era export', async () => {
    const source = fresh()
    const ref = await source.store.put(nodeBlob(pngBytes(4)), { width: 9, height: 9 })
    const cards = [{ ...textCard(1), promptImage: ref }]
    const refs = collectMediaRefs(cards)
    const exported = {
      seshatExportVersion: 1 as const,
      name: 'S',
      description: '',
      tags: [],
      cards: cards.map(({ prompt, promptImage, content, explanation, sourceRef, tags }) => ({
        prompt,
        promptImage,
        content,
        explanation,
        sourceRef,
        tags,
      })),
    }
    const { value: media } = await loadMediaMap(source.store, refs)
    expect(exportedSetSchema.safeParse({ ...exported, media }).success).toBe(true)
    const blob = await toJsonBlobWithMedia(exported, source.store, refs)
    const reparsed = exportedSetSchema.parse(JSON.parse(await readText(blob.value))) as ExportedSet
    expect(Object.keys(reparsed.media ?? {})).toEqual([ref.id])

    const target = fresh()
    const prepared = await prepareCardsForImport(reparsed.cards, reparsed.media, target)
    expect(prepared.ok && prepared.value.missing).toBe(0)
    expect(await target.store.has(ref.id)).toBe(true)

    const v1Era = exportedSetSchema.parse({
      seshatExportVersion: 1,
      name: 'Old',
      description: '',
      tags: [],
      cards: [
        {
          prompt: 'Label',
          content: {
            kind: 'image-occlusion',
            imageDataUrl: dataUrlOf(pngBytes(8)),
            occlusions: [{ id: 'r', xPct: 0, yPct: 0, widthPct: 10, heightPct: 10, label: 'l' }],
          },
          explanation: null,
          sourceRef: null,
          tags: [],
        },
      ],
    })
    const upgraded = await prepareCardsForImport(v1Era.cards, v1Era.media, target)
    expect(upgraded.ok && upgraded.value.cards[0]?.content).toMatchObject({ image: { mime: 'image/png' } })
  })

  it('an image-occlusion card with neither image nor data URL is rejected by the schema', () => {
    const bad = {
      seshatExportVersion: 1,
      name: 'S',
      description: '',
      tags: [],
      cards: [
        {
          prompt: 'x',
          content: {
            kind: 'image-occlusion',
            occlusions: [{ id: 'r', xPct: 0, yPct: 0, widthPct: 1, heightPct: 1, label: 'l' }],
          },
          explanation: null,
          sourceRef: null,
          tags: [],
        },
      ],
    }
    expect(exportedSetSchema.safeParse(bad).success).toBe(false)
  })
})
