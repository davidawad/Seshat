import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { z } from 'zod'
import { simpleImportSchema } from '../src/features/sets/simple-json.ts'
import { exportedSetSchema } from '../src/types.ts'

/**
 * Agent-discovery files that must stay in sync with repo sources or carry
 * the deploy base path, so they are generated rather than copied from
 * public/: /llms.txt, /llms-full.txt, /AGENTS.md and the import JSON Schema.
 * (robots.txt, ai.txt, humans.txt and agents.txt are base-independent and
 * live as plain files in public/.)
 */

export const SCHEMA_PATH = 'schema/set-import.schema.json'

/** Concatenation sources for llms-full.txt, in order. Paths are repo-relative. */
const FULL_SOURCES = ['README.md', 'AGENTS.md', 'public/agents.txt', 'research/README.md'] as const

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
    `- [agents.txt](${base}agents.txt): How to import sets via ?import=, the window.seshat console API, driving the UI, and planned features`,
    `- [AGENTS.md](${base}AGENTS.md): Repo workflow instructions for coding agents (scripts, conventions, architecture notes)`,
    `- [llms-full.txt](${base}llms-full.txt): README, AGENTS.md, agents.txt and the research index concatenated into one file`,
    '',
    '## Data formats',
    '',
    `- [Set import JSON Schema](${base}${SCHEMA_PATH}): JSON Schema for the simple {name, terms} import shape and the full seshatExportVersion 1 export shape`,
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
      'Either the simple term/definition shape (an object {name, terms} or a bare array of term/definition pairs) or the full Seshat export (seshatExportVersion 1).',
    anyOf: [simpleShape, exportShape],
  }
}

type Asset = { readonly fileName: string; readonly type: string; readonly body: (root: string, base: string) => string }

const read = (root: string, rel: string): string => readFileSync(resolve(root, rel), 'utf8')

const ASSETS: readonly Asset[] = [
  { fileName: 'llms.txt', type: 'text/plain; charset=utf-8', body: (_root, base) => buildLlmsTxt(base) },
  {
    fileName: 'llms-full.txt',
    type: 'text/plain; charset=utf-8',
    body: (root) => buildLlmsFull(FULL_SOURCES.map((name) => ({ name, text: read(root, name) }))),
  },
  { fileName: 'AGENTS.md', type: 'text/markdown; charset=utf-8', body: (root) => read(root, 'AGENTS.md') },
  {
    fileName: SCHEMA_PATH,
    type: 'application/schema+json; charset=utf-8',
    body: () => `${JSON.stringify(buildImportSchema(), null, 2)}\n`,
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
