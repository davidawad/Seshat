import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { z } from 'zod'
import { BACKUP_FORMAT, BACKUP_VERSION, backupSchema } from '../src/lib/backup-schema.ts'
import { simpleImportSchema } from '../src/features/sets/simple-json.ts'
import { DEFAULT_SETTINGS, exportedSetSchema, settingsSchema } from '../src/types.ts'

/**
 * Agent-discovery files that must stay in sync with repo sources or carry
 * the deploy base path, so they are generated rather than copied from
 * public/: /llms.txt, /llms-full.txt, /AGENTS.md and the three JSON Schemas (set import, full backup, settings).
 * (robots.txt, ai.txt, humans.txt and agents.txt are base-independent and
 * live as plain files in public/.)
 */

export const SCHEMA_PATH = 'schema/set-import.schema.json'
export const BACKUP_SCHEMA_PATH = 'schema/seshat-backup.schema.json'
export const SETTINGS_SCHEMA_PATH = 'schema/seshat-settings.schema.json'

/** Concatenation sources for llms-full.txt, in order. Paths are repo-relative. */
const FULL_SOURCES = ['README.md', 'AGENTS.md', 'public/agents.txt', 'research/README.md'] as const

/**
 * Only these `## ` sections of the repo AGENTS.md are published (at /AGENTS.md and inside llms-full.txt).
 * An allowlist, so a new internal section (issue tracker, session workflow...) never leaks by default.
 * The preamble before the first `## ` heading is always kept.
 */
export const PUBLIC_AGENTS_HEADINGS: readonly string[] = [
  'Orientation',
  'Running it locally',
  'The `window.seshat` browser-console API',
  'URL query-param import (the fast path for a fresh set)',
  'Card kinds — which are realistic to author via URL import',
  'WebMCP tools',
  'Full-data backup',
  'Settings, cookie mirror and keybindings',
]

/** AGENTS.md reduced to the preamble plus the allowlisted `## ` sections (fenced code is never mistaken for a heading). */
export const publicAgentsMd = (text: string): string => {
  let fenced = false
  let keep = true
  const out: string[] = []
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) fenced = !fenced
    if (!fenced && line.startsWith('## ')) keep = PUBLIC_AGENTS_HEADINGS.includes(line.slice(3).trim())
    if (keep) out.push(line)
  }
  return `${out.join('\n').trim()}\n`
}

/** `base` is Vite's resolved base: always starts and ends with '/'. */
export const buildLlmsTxt = (base: string): string =>
  [
    '# Seshat',
    '',
    "> Seshat is a free, local-first flashcard and spaced-repetition web app (FSRS scheduling, recall-first card types). There is no backend, account or API: all data lives in the visitor's browser (localStorage, with settings also mirrored to a small cookie). Agents can load study material through a URL query parameter (`?import=`) or the `window.seshat` console API.",
    '',
    'Seshat is open source (GPL-3.0-or-later). Links below are paths on this site.',
    '',
    '## Agent guides',
    '',
    `- [agents.txt](${base}agents.txt): How to import sets via ?import=, the window.seshat console API, WebMCP tools, the JSON backup, keyboard shortcuts, settings and driving the UI`,
    `- [AGENTS.md](${base}AGENTS.md): Repo workflow instructions for coding agents (scripts, conventions, architecture notes)`,
    `- [llms-full.txt](${base}llms-full.txt): README, AGENTS.md, agents.txt and the research index concatenated into one file`,
    '',
    '## Data formats',
    '',
    `- [Set import JSON Schema](${base}${SCHEMA_PATH}): JSON Schema for the simple {name, terms} import shape and the full seshatExportVersion 1 export shape`,
    `- [Backup JSON Schema](${base}${BACKUP_SCHEMA_PATH}): JSON Schema for the full-data backup file (format "seshat-backup", version 2: images travel as base64 in a media map; version 1 files still import) accepted by window.seshat.importAll, the WebMCP import_all tool and Settings -> Backup`,
    `- [Settings JSON Schema](${base}${SETTINGS_SCHEMA_PATH}): JSON Schema for the settings object (every field with its allowed values, range and default), as read by get_settings and patched by update_settings`,
    '',
    '## Docs',
    '',
    `- [Docs](${base}docs): In-app documentation of the study methods and import/export`,
    `- [Attributions](${base}attributions): Research citations behind the design decisions`,
    `- [License](${base}licensing): GNU General Public License v3 or later`,
    '',
    '## Optional',
    '',
    `- [humans.txt](${base}humans.txt): Credits and stack`,
    `- [ai.txt](${base}ai.txt): AI usage policy (training, scraping and indexing are permitted)`,
    '',
  ].join('\n')

/** One file per section, separated by a clear marker so an LLM can tell where each source starts. */
export const buildLlmsFull = (sources: readonly { readonly name: string; readonly text: string }[]): string =>
  sources.map(({ name, text }) => `<!-- ===== ${name} ===== -->\n\n${text.trim()}\n`).join('\n')

/** The accepted import shapes, as one JSON Schema (input side: what a file may contain, not what parsing yields). */
export const buildImportSchema = (): Record<string, unknown> => {
  const toSchema = (schema: z.ZodType) => z.toJSONSchema(schema, { io: 'input', target: 'draft-2020-12' })
  const { $schema, ...exportShape } = toSchema(exportedSetSchema)
  const { $schema: _simpleMeta, ...simpleShape } = toSchema(simpleImportSchema)
  return {
    $schema,
    title: 'Seshat set import',
    description:
      'Either the simple term/definition shape (an object {name, terms} or a bare array of term/definition pairs) or the full Seshat export (seshatExportVersion 1). In the full export, images are listed in an optional `media` map (mediaId -> {mime, dataBase64, width, height}) that cards reference through MediaRefs; an image-occlusion card (a labeled diagram; one card per label) needs `image` (a MediaRef) or, in older exports, an inline `imageDataUrl` (the app rejects a card with neither; this schema cannot express that rule), plus `occlusions` (all regions) and optionally `askedRegionId` (the region this card asks about) and `diagramId` (shared by the cards of one diagram).',
    anyOf: [simpleShape, exportShape],
  }
}

const draft = 'draft-2020-12'

/**
 * Every settings field (enum/min/max) with its default, as a plain `properties` map. Shared by the
 * settings schema and the backup schema's `settings` entry: the runtime backup schema keeps
 * `settings` as an untyped record that `parseSettingsPatch` validates key by key, so the published
 * schema substitutes this description to tell agents which keys are valid.
 */
const settingsProperties = (): Record<string, Record<string, unknown>> => {
  const { properties } = z.toJSONSchema(settingsSchema, { io: 'output', target: draft }) as {
    properties?: Record<string, Record<string, unknown>>
  }
  return Object.fromEntries(
    Object.entries(properties ?? {}).map(([key, prop]) => [
      key,
      key in DEFAULT_SETTINGS ? { ...prop, default: DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] } : prop,
    ]),
  )
}

/** The full backup envelope as JSON Schema: what a file may contain (input side, so settings may be partial). */
export const buildBackupSchema = (base = '/'): Record<string, unknown> => {
  const { $schema, ...shape } = z.toJSONSchema(backupSchema, { io: 'input', target: draft }) as Record<string, unknown>
  const envelopeProperties = (shape['properties'] ?? {}) as Record<string, unknown>
  return {
    $schema,
    $id: `${base}${BACKUP_SCHEMA_PATH}`,
    title: 'Seshat backup',
    description: `Full-data backup (format "${BACKUP_FORMAT}", version ${BACKUP_VERSION}): settings, keybinding overrides, sets, cards with FSRS scheduling, review history, and a \`media\` map (mediaId = sha-256 hex of the image bytes -> {mime, dataBase64, width, height}) holding every image the cards reference through MediaRefs. Version 1 files (images inline as imageDataUrl data URLs, no media map) are still accepted and upgraded on import. An image-occlusion card needs \`image\` (a MediaRef) or a legacy \`imageDataUrl\` (the app rejects a card with neither; this schema cannot express that rule). Settings may list only the fields to restore. Cards must reference existing sets and review-log entries existing cards; ids must be unique; every media entry must be used by a card.`,
    ...shape,
    properties: {
      ...envelopeProperties,
      settings: {
        type: 'object',
        description: 'Any subset of the settings fields; unknown fields are rejected.',
        properties: settingsProperties(),
        additionalProperties: false,
      },
    },
  }
}

/** The settings object as JSON Schema: every field with its enum/min/max and its default. */
export const buildSettingsSchema = (base = '/'): Record<string, unknown> => {
  const { $schema, ...shape } = z.toJSONSchema(settingsSchema, { io: 'output', target: draft }) as Record<
    string,
    unknown
  >
  return {
    $schema,
    $id: `${base}${SETTINGS_SCHEMA_PATH}`,
    title: 'Seshat settings',
    description:
      'The settings object returned by get_settings and stored in a backup. A complete object lists every field; update_settings and a backup accept any subset (unknown fields are rejected).',
    ...shape,
    properties: settingsProperties(),
  }
}

type Asset = { readonly fileName: string; readonly type: string; readonly body: (root: string, base: string) => string }

const read = (root: string, rel: string): string => readFileSync(resolve(root, rel), 'utf8')

const readSource = (root: string, rel: string): string => {
  const text = read(root, rel)
  return rel === 'AGENTS.md' ? publicAgentsMd(text) : text
}

export const buildLlmsFullFromRoot = (root: string): string =>
  buildLlmsFull(FULL_SOURCES.map((name) => ({ name, text: readSource(root, name) })))

const ASSETS: readonly Asset[] = [
  { fileName: 'llms.txt', type: 'text/plain; charset=utf-8', body: (_root, base) => buildLlmsTxt(base) },
  {
    fileName: 'llms-full.txt',
    type: 'text/plain; charset=utf-8',
    body: (root) => buildLlmsFullFromRoot(root),
  },
  { fileName: 'AGENTS.md', type: 'text/markdown; charset=utf-8', body: (root) => readSource(root, 'AGENTS.md') },
  {
    fileName: SCHEMA_PATH,
    type: 'application/schema+json; charset=utf-8',
    body: () => `${JSON.stringify(buildImportSchema(), null, 2)}\n`,
  },
  {
    fileName: BACKUP_SCHEMA_PATH,
    type: 'application/schema+json; charset=utf-8',
    body: (_root, base) => `${JSON.stringify(buildBackupSchema(base), null, 2)}\n`,
  },
  {
    fileName: SETTINGS_SCHEMA_PATH,
    type: 'application/schema+json; charset=utf-8',
    body: (_root, base) => `${JSON.stringify(buildSettingsSchema(base), null, 2)}\n`,
  },
]

export const agentFiles = (): Plugin => {
  let root = process.cwd()
  let base = '/'
  return {
    name: 'seshat-agent-files',
    configResolved(config) {
      root = config.root
      base = config.base
    },
    // Dev and preview: Vite strips `base` before custom middleware sees the URL.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]?.replace(/^\//, '')
        const asset = ASSETS.find((a) => a.fileName === path)
        if (asset === undefined) return next()
        res.setHeader('Content-Type', asset.type)
        res.end(asset.body(root, base))
      })
    },
    generateBundle() {
      for (const asset of ASSETS) {
        this.emitFile({ type: 'asset', fileName: asset.fileName, source: asset.body(root, base) })
      }
    },
  }
}
