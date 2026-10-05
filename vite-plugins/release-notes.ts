import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import {
  GIT_LOG_FORMAT,
  type ReleaseData,
  buildReleaseData,
  parseGitLog,
  renderChangelogMarkdown,
  renderReleasesText,
} from '../src/lib/releases.ts'

/**
 * Release notes generated from git history at build time (never committed): a virtual module for the
 * /releases page plus /releases.txt and /CHANGELOG.md for agents. Without git or history it degrades to
 * an empty list with an explanatory message instead of failing the build.
 */

export const VIRTUAL_ID = 'virtual:seshat-releases'
export const RELEASES_TXT = 'releases.txt'
export const CHANGELOG_MD = 'CHANGELOG.md'

/** Run git in `root`; resolves to stdout, or `null` when git is missing or the command fails. */
export type GitRunner = (args: readonly string[]) => string | null

export const execGit =
  (root: string): GitRunner =>
  (args) => {
    try {
      return execFileSync('git', [...args], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    } catch {
      return null
    }
  }

export const readReleaseData = (git: GitRunner, appVersion: string): ReleaseData => {
  const log = git(['log', '--topo-order', '-n', '2000', `--format=${GIT_LOG_FORMAT}`])
  const shallow = git(['rev-parse', '--is-shallow-repository'])?.trim() === 'true'
  return buildReleaseData({ appVersion, commits: log === null ? null : parseGitLog(log), shallow })
}

const readVersion = (root: string): string => {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { version?: string }
  return pkg.version ?? '0.0.0'
}

export const releaseNotes = (): Plugin => {
  let root = process.cwd()
  let cached: ReleaseData | null = null
  const data = (): ReleaseData => (cached ??= readReleaseData(execGit(root), readVersion(root)))
  const files = [
    { fileName: RELEASES_TXT, type: 'text/plain; charset=utf-8', body: () => renderReleasesText(data()) },
    { fileName: CHANGELOG_MD, type: 'text/markdown; charset=utf-8', body: () => renderChangelogMarkdown(data()) },
  ]
  const resolved = `\0${VIRTUAL_ID}`
  return {
    name: 'seshat-release-notes',
    configResolved(config) {
      root = config.root
    },
    resolveId: (id) => (id === VIRTUAL_ID ? resolved : null),
    load: (id) => (id === resolved ? `export default ${JSON.stringify(data())}` : null),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]?.replace(/^\//, '')
        const file = files.find((f) => f.fileName === path)
        if (file === undefined) return next()
        res.setHeader('Content-Type', file.type)
        res.end(file.body())
      })
    },
    generateBundle() {
      for (const file of files) this.emitFile({ type: 'asset', fileName: file.fileName, source: file.body() })
    },
  }
}
