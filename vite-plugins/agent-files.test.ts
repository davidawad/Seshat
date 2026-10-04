import { describe, expect, it } from 'vitest'
import { BACKUP_FORMAT, BACKUP_VERSION, backupSchema } from '../src/lib/backup-schema.ts'
import { createInitialScheduling } from '../src/lib/fsrs.ts'
import {
  type AppState,
  DEFAULT_SETTINGS,
  cardIdSchema,
  createEmptyAppState,
  exportedSetSchema,
  setIdSchema,
  settingsSchema,
} from '../src/types.ts'
import {
  BACKUP_SCHEMA_PATH,
  SCHEMA_PATH,
  SETTINGS_SCHEMA_PATH,
  buildBackupSchema,
  buildImportSchema,
  buildLlmsFull,
  PUBLIC_AGENTS_HEADINGS,
  buildLlmsFullFromRoot,
  buildLlmsTxt,
  publicAgentsMd,
} from './agent-files.ts'
import { buildSettingsSchema } from './agent-files.ts'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type Json = unknown
type Obj = Record<string, Json>

/** Tiny JSON Schema (2020-12 subset Zod emits) validator, for parity tests only. Returns true when `value` conforms. */
const isObj = (v: Json): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: Json): number | undefined => (typeof v === 'number' ? v : undefined)

const checkString = (schema: Obj, value: Json): boolean => {
  if (typeof value !== 'string') return false
  const min = num(schema['minLength'])
  if (min !== undefined && value.length < min) return false
  return typeof schema['pattern'] !== 'string' || new RegExp(schema['pattern']).test(value)
}

const checkNumber = (schema: Obj, value: Json, integer: boolean): boolean => {
  if (typeof value !== 'number' || (integer && !Number.isInteger(value))) return false
  const min = num(schema['minimum'])
  const max = num(schema['maximum'])
  return (min === undefined || value >= min) && (max === undefined || value <= max)
}

const checkObject = (schema: Obj, value: Json, root: Obj): boolean => {
  if (!isObj(value)) return false
  const props = (schema['properties'] ?? {}) as Record<string, Obj>
  const required = (schema['required'] ?? []) as string[]
  const extra = schema['additionalProperties']
  const fits = ([key, v]: [string, Json]): boolean => {
    const own = props[key]
    if (own !== undefined) return validate(own, v, root)
    return isObj(extra) ? validate(extra, v, root) : extra !== false
  }
  return required.every((key) => key in value) && Object.entries(value).every(fits)
}

const checkArray = (schema: Obj, value: Json, root: Obj): boolean => {
  if (!Array.isArray(value)) return false
  const items = schema['items']
  return !isObj(items) || value.every((v) => validate(items, v, root))
}

type Check = (schema: Obj, value: Json, root: Obj) => boolean
const TYPE_CHECKS: Record<string, Check> = {
  null: (_s, v) => v === null,
  boolean: (_s, v) => typeof v === 'boolean',
  string: (s, v) => checkString(s, v),
  number: (s, v) => checkNumber(s, v, false),
  integer: (s, v) => checkNumber(s, v, true),
  array: checkArray,
  object: checkObject,
}

const validate = (schema: Obj, value: Json, root: Obj = schema): boolean => {
  const ref = schema['$ref']
  if (typeof ref === 'string') {
    const target = ref
      .split('/')
      .slice(1)
      .reduce<Json>((node, key) => (node as Obj)[key], root)
    return validate(target as Obj, value, root)
  }
  if (Array.isArray(schema['anyOf'])) return (schema['anyOf'] as Obj[]).some((s) => validate(s, value, root))
  if ('const' in schema) return schema['const'] === value
  if (Array.isArray(schema['enum'])) return schema['enum'].includes(value)
  const checker = TYPE_CHECKS[String(schema['type'])]
  return checker === undefined ? true : checker(schema, value, root)
}

describe('buildLlmsTxt', () => {
  it('follows the llms.txt layout: H1, blockquote, H2 link lists', () => {
    const lines = buildLlmsTxt('/').split('\n')
    expect(lines[0]).toBe('# Seshat')
    expect(lines.some((l) => l.startsWith('> '))).toBe(true)
    expect(lines.filter((l) => l.startsWith('## '))).toContain('## Optional')
  })

  it('prefixes every link with the deploy base', () => {
    for (const base of ['/', '/seshat/']) {
      const links = [...buildLlmsTxt(base).matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1])
      expect(links.length).toBeGreaterThan(5)
      for (const link of links) expect(link?.startsWith(base)).toBe(true)
      for (const path of [SCHEMA_PATH, BACKUP_SCHEMA_PATH, SETTINGS_SCHEMA_PATH]) {
        expect(links).toContain(`${base}${path}`)
      }
    }
  })
})

describe('buildLlmsFull', () => {
  it('labels and joins sources in order', () => {
    const out = buildLlmsFull([
      { name: 'a.md', text: 'one\n' },
      { name: 'b.txt', text: 'two' },
    ])
    expect(out.indexOf('a.md')).toBeLessThan(out.indexOf('b.txt'))
    expect(out).toContain('one')
    expect(out).toContain('two')
  })
})

describe('buildImportSchema', () => {
  const schema = buildImportSchema()

  it('offers the simple and full shapes', () => {
    expect(schema['$schema']).toContain('json-schema.org')
    expect(schema['anyOf']).toHaveLength(2)
  })

  it('is JSON-serializable', () => {
    expect(() => JSON.stringify(schema)).not.toThrow()
  })

  it('describes the same set the Zod export schema accepts', () => {
    const sample = {
      seshatExportVersion: 1,
      name: 'S',
      description: '',
      tags: [],
      cards: [
        {
          prompt: 'Q',
          content: { kind: 'short-answer', answer: 'A', acceptableAnswers: [] },
          explanation: null,
          sourceRef: null,
          tags: [],
        },
      ],
    }
    expect(exportedSetSchema.safeParse(sample).success).toBe(true)
    expect(JSON.stringify(schema)).toContain('seshatExportVersion')
  })
})

const ISO = '2026-10-03T12:00:00.000Z'
// Mirrors createBackup() (src/lib/backup.ts, which needs browser types this node-side project lacks).
const createBackup = (state: AppState, keybindings: Record<string, string>, now: Date) => ({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  appVersion: '0.0.0',
  exportedAt: now.toISOString(),
  settings: state.settings,
  keybindings,
  sets: state.sets,
  cards: state.cards,
  reviewLog: state.reviewLog,
  media: {},
})

const sampleState = () => {
  const setId = setIdSchema.parse('00000000-0000-4000-8000-000000000001')
  return {
    ...createEmptyAppState(),
    sets: [{ id: setId, name: 'S', description: '', tags: [], createdAt: ISO, updatedAt: ISO, goalDate: null }],
    cards: [
      {
        id: cardIdSchema.parse('10000000-0000-4000-8000-000000000001'),
        setId,
        prompt: 'Q',
        promptImage: null,
        content: { kind: 'short-answer' as const, acceptableAnswers: [], answerImage: null, answer: 'A' },
        explanation: null,
        sourceRef: null,
        tags: [],
        createdAt: ISO,
        updatedAt: ISO,
        scheduling: createInitialScheduling(new Date(ISO)),
      },
    ],
  }
}

describe('buildBackupSchema', () => {
  const schema = buildBackupSchema('/seshat/')
  const backup = JSON.parse(
    JSON.stringify(createBackup(sampleState(), { 'flashcards.undo': 'Z' }, new Date(ISO))),
  ) as Obj

  it('has a base-prefixed $id, title, description and draft 2020-12', () => {
    expect(schema['$schema']).toContain('2020-12')
    expect(schema['$id']).toBe(`/seshat/${BACKUP_SCHEMA_PATH}`)
    expect(schema['title']).toBe('Seshat backup')
    expect(schema['description']).toContain('seshat-backup')
  })

  it('accepts a real createBackup output, an empty one, and one with partial settings', () => {
    expect(backupSchema.safeParse(backup).success).toBe(true)
    expect(validate(schema, backup)).toBe(true)
    expect(validate(schema, JSON.parse(JSON.stringify(createBackup(createEmptyAppState(), {}, new Date(ISO)))))).toBe(
      true,
    )
    expect(validate(schema, { ...backup, settings: { theme: 'dark' } })).toBe(true)
  })

  it('describes the v2 media map and the new card image fields', () => {
    const props = schema['properties'] as Record<string, Obj>
    expect(props['version']).toMatchObject({ const: 2 })
    expect(props['media']).toBeDefined()
    const media = { ['a'.repeat(64)]: { mime: 'image/png', dataBase64: 'AAAA', width: 1, height: 1 } }
    expect(validate(schema, { ...backup, media })).toBe(true)
    expect(
      validate(schema, {
        ...backup,
        media: { ['a'.repeat(64)]: { mime: 'image/gif', dataBase64: 'AAAA', width: 1, height: 1 } },
      }),
    ).toBe(false)
    const text = JSON.stringify(schema)
    expect(text).toContain('promptImage')
    expect(text).toContain('answerImage')
    expect(text).toContain('imageDataUrl')
  })

  it('rejects garbage', () => {
    expect(validate(schema, 'nope')).toBe(false)
    expect(validate(schema, {})).toBe(false)
    expect(validate(schema, { ...backup, format: 'other' })).toBe(false)
    expect(validate(schema, { ...backup, version: 1 })).toBe(false)
    expect(validate(schema, { ...backup, version: 3 })).toBe(false)
    expect(validate(schema, { ...backup, extra: 1 })).toBe(false)
    expect(validate(schema, { ...backup, settings: { theme: 'neon' } })).toBe(false)
    expect(validate(schema, { ...backup, settings: { bodyFontSizePt: 99 } })).toBe(false)
    expect(validate(schema, { ...backup, sets: [{ id: 'x' }] })).toBe(false)
  })
})

describe('buildSettingsSchema', () => {
  const schema = buildSettingsSchema()
  const props = schema['properties'] as Record<string, Obj>

  it('describes every Settings field with its default', () => {
    expect(Object.keys(props).sort()).toEqual(Object.keys(settingsSchema.shape).sort())
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) expect(props[key]?.['default']).toEqual(value)
  })

  it('exposes enums and ranges', () => {
    expect(props['theme']?.['enum']).toEqual(['light', 'dark', 'system'])
    expect(props['bodyFontSizePt']).toMatchObject({ minimum: 11.5, maximum: 13 })
    expect(props['flashcardsFront']?.['enum']).toEqual(['term', 'definition'])
  })

  it('accepts DEFAULT_SETTINGS and rejects out-of-range or unknown fields, matching Zod', () => {
    const bad = [{ ...DEFAULT_SETTINGS, theme: 'neon' }, { ...DEFAULT_SETTINGS, lineHeight: 3 }, { nope: 1 }]
    expect(validate(schema, DEFAULT_SETTINGS)).toBe(true)
    for (const candidate of bad) {
      expect(validate(schema, candidate)).toBe(false)
      expect(settingsSchema.safeParse(candidate).success).toBe(false)
    }
  })
})

describe('public AGENTS.md allowlist', () => {
  const root = resolve(import.meta.dirname, '..')
  const forbidden = ['Beads', 'br ready', 'git ' + 'push', 'Session Completion']
  const headings = (text: string): string[] => {
    let fenced = false
    return text.split('\n').flatMap((line) => {
      if (line.startsWith('```')) fenced = !fenced
      return !fenced && line.startsWith('## ') ? [line.slice(3).trim()] : []
    })
  }
  const agentsMd = publicAgentsMd(readFileSync(resolve(root, 'AGENTS.md'), 'utf8'))
  const llmsFull = buildLlmsFullFromRoot(root)

  it('/AGENTS.md has only allowlisted headings', () => {
    expect(agentsMd).toContain('Orientation')
    for (const heading of headings(agentsMd)) expect(PUBLIC_AGENTS_HEADINGS).toContain(heading)
  })

  it('/AGENTS.md and llms-full.txt contain no internal workflow text', () => {
    for (const word of forbidden) {
      expect(agentsMd).not.toContain(word)
      expect(llmsFull).not.toContain(word)
    }
  })

  it('drops an unlisted section by default, keeps listed ones and fenced "## " lines', () => {
    const out = publicAgentsMd(
      '# T\n\nintro\n\n## Orientation\nkeep\n```\n## Beads\n```\n\n## Secret new section\ngone\n',
    )
    expect(out).toContain('intro')
    expect(out).toContain('keep')
    expect(out).toContain('## Beads')
    expect(out).not.toContain('Secret')
    expect(out).not.toContain('gone')
  })
})
