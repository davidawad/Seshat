/**
 * Release notes, derived from git history (conventional commits + `v*.*.*` tags).
 *
 * Pure parsing, grouping and rendering: no I/O, no Node APIs. The Vite plugin
 * (vite-plugins/release-notes.ts) feeds it `git log` output at build time, the
 * release script (scripts/release.ts) reuses it for the CHANGELOG entry, and the
 * Release notes page renders the resulting `ReleaseData`. Author names and emails
 * are never read, so they cannot leak.
 */

export const GITHUB_URL = 'https://github.com/davidawad/Seshat'
export const GITLAB_URL = 'https://gitlab.com/davidawad/seshat'

export const githubCommitUrl = (sha: string): string => `${GITHUB_URL}/commit/${sha}`
export const gitlabCommitUrl = (sha: string): string => `${GITLAB_URL}/-/commit/${sha}`

export type SectionKind = 'features' | 'fixes' | 'accessibility' | 'performance' | 'maintenance'

export interface ReleaseEntry {
  readonly sha: string
  readonly short: string
  /** The commit subject without its `type(scope):` prefix, first letter capitalised. */
  readonly text: string
  /** The conventional-commit scope, shown as a label. */
  readonly scope: string | null
  readonly breaking: boolean
}

export interface ReleaseSection {
  readonly kind: SectionKind
  readonly title: string
  readonly entries: readonly ReleaseEntry[]
}

export interface Release {
  /** `0.1.0` for a tagged release, `null` for the Unreleased group. */
  readonly version: string | null
  /** `v0.1.0`, or `null` when unreleased. */
  readonly tag: string | null
  /** `YYYY-MM-DD` of the tagged commit, `null` when unreleased. */
  readonly date: string | null
  readonly sections: readonly ReleaseSection[]
}

/** `ok`: history read. `shallow`: read, but a shallow clone hides older commits. `no-git`: nothing to read. */
export type HistoryStatus = 'ok' | 'shallow' | 'no-git'

export interface ReleaseData {
  /** package.json `version` at build time. */
  readonly appVersion: string
  readonly status: HistoryStatus
  /** A human-readable explanation when `status` is not `ok` or there are no tags yet; empty otherwise. */
  readonly message: string
  readonly releases: readonly Release[]
}

/** One commit as read from git: the only fields the notes need. */
export interface RawCommit {
  readonly sha: string
  /** ISO-8601 committer date. */
  readonly date: string
  /** Ref names git decorated the commit with (`%D`), e.g. `HEAD -> main, tag: v1.0.0`. */
  readonly refs: string
  readonly subject: string
}

const SECTION_ORDER: readonly { readonly kind: SectionKind; readonly title: string }[] = [
  { kind: 'features', title: 'Features' },
  { kind: 'fixes', title: 'Fixes' },
  { kind: 'accessibility', title: 'Accessibility' },
  { kind: 'performance', title: 'Performance' },
  { kind: 'maintenance', title: 'Maintenance' },
]

const SEMVER_TAG = /^v(\d+\.\d+\.\d+)$/

/** `abc, tag: v1.2.3, tag: nightly` -> the semver tag versions found, newest-first order preserved. */
export const tagVersions = (refs: string): string[] =>
  refs
    .split(',')
    .map((ref) => ref.trim())
    .filter((ref) => ref.startsWith('tag: '))
    .map((ref) => SEMVER_TAG.exec(ref.slice(5))?.[1])
    .filter((version): version is string => version !== undefined)

const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  return pa[0]! - pb[0]! || pa[1]! - pb[1]! || pa[2]! - pb[2]!
}

/** Merge commits, landing-queue merges and the release bump commit carry no change of their own. */
export const isMergeNoise = (subject: string): boolean =>
  /^merge\b/i.test(subject) ||
  /^chore(\([^)]*\))?!?: merge .*\(land\)\s*$/i.test(subject) ||
  /^chore\(release\):/i.test(subject)

const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/

const capitalise = (text: string): string => (text === '' ? text : text[0]!.toUpperCase() + text.slice(1))

export interface ParsedSubject {
  readonly type: string | null
  readonly scope: string | null
  readonly breaking: boolean
  readonly text: string
}

/** `fix(a11y)!: land focus` -> `{type: 'fix', scope: 'a11y', breaking: true, text: 'Land focus'}`; non-conventional subjects keep their text. */
export const parseSubject = (subject: string): ParsedSubject => {
  const match = CONVENTIONAL.exec(subject.trim())
  if (match === null) return { type: null, scope: null, breaking: false, text: capitalise(subject.trim()) }
  const [, type, scope, bang, text] = match
  return {
    type: type!.toLowerCase(),
    scope: scope?.trim() ?? null,
    breaking: bang === '!',
    text: capitalise(text!.trim()),
  }
}

/** Which section a parsed subject belongs under. Accessibility is a scope, so it wins over the type. */
export const sectionFor = ({ type, scope }: ParsedSubject): SectionKind => {
  if (scope?.toLowerCase() === 'a11y' || type === 'a11y') return 'accessibility'
  if (type === 'feat') return 'features'
  if (type === 'fix') return 'fixes'
  if (type === 'perf') return 'performance'
  return 'maintenance'
}

const toEntry = (commit: RawCommit, parsed: ParsedSubject): ReleaseEntry => ({
  sha: commit.sha,
  short: commit.sha.slice(0, 7),
  text: parsed.text,
  // a11y is already the section title, so repeating it as a label adds nothing.
  scope: parsed.scope !== null && parsed.scope.toLowerCase() !== 'a11y' ? parsed.scope : null,
  breaking: parsed.breaking,
})

/** Bucket one release's commits into the fixed section order; empty sections are dropped. */
export const groupSections = (commits: readonly RawCommit[]): ReleaseSection[] => {
  const buckets = new Map<SectionKind, ReleaseEntry[]>()
  for (const commit of commits) {
    if (isMergeNoise(commit.subject)) continue
    const parsed = parseSubject(commit.subject)
    const kind = sectionFor(parsed)
    buckets.set(kind, [...(buckets.get(kind) ?? []), toEntry(commit, parsed)])
  }
  return SECTION_ORDER.flatMap(({ kind, title }) => {
    const entries = buckets.get(kind)
    return entries === undefined ? [] : [{ kind, title, entries }]
  })
}

/**
 * Group commits (newest first, as `git log` prints them) into releases. A commit carrying a `vX.Y.Z` tag
 * closes the group it belongs to (that group is the tagged release); everything newer is Unreleased.
 * Unreleased always comes first, and only appears when it holds at least one change.
 */
export const groupReleases = (commits: readonly RawCommit[]): Release[] => {
  const groups: { version: string | null; date: string | null; commits: RawCommit[] }[] = [
    { version: null, date: null, commits: [] },
  ]
  for (const commit of commits) {
    const tagged = tagVersions(commit.refs).sort((a, b) => compareVersions(b, a))[0]
    if (tagged !== undefined) groups.push({ version: tagged, date: commit.date.slice(0, 10), commits: [] })
    groups[groups.length - 1]!.commits.push(commit)
  }
  return groups
    .map(({ version, date, commits: inGroup }) => ({
      version,
      tag: version === null ? null : `v${version}`,
      date,
      sections: groupSections(inGroup),
    }))
    .filter((release) => release.version !== null || release.sections.length > 0)
}

/** Parse the `git log` records produced by `GIT_LOG_FORMAT`: one record per commit, fields split by US, records by RS. */
export const GIT_LOG_FORMAT = '%H%x1f%cI%x1f%D%x1f%s%x1e'

export const parseGitLog = (output: string): RawCommit[] =>
  output
    .split('\x1e')
    .map((record) => record.replace(/^\n+/, ''))
    .filter((record) => record.trim() !== '')
    .flatMap((record) => {
      const [sha, date, refs, subject] = record.split('\x1f')
      return sha === undefined || date === undefined || subject === undefined
        ? []
        : [{ sha: sha.trim(), date: date.trim(), refs: refs ?? '', subject: subject.trim() }]
    })

export const NO_GIT_MESSAGE =
  'Release notes are generated from git history at build time, and git was not available for this build, so there is nothing to list yet.'
export const SHALLOW_MESSAGE =
  'This build was made from a shallow clone, so older releases may be missing. Build with full history (git fetch --unshallow --tags) to list every release.'
export const NO_TAGS_MESSAGE =
  'No release tags (vX.Y.Z) exist yet, so every change is listed under Unreleased. Tagging a release (just release) starts the first section.'

export interface BuildInput {
  readonly appVersion: string
  /** `null` when git could not be run at all. */
  readonly commits: readonly RawCommit[] | null
  readonly shallow: boolean
}

export const buildReleaseData = ({ appVersion, commits, shallow }: BuildInput): ReleaseData => {
  if (commits === null || commits.length === 0) {
    return { appVersion, status: 'no-git', message: NO_GIT_MESSAGE, releases: [] }
  }
  const releases = groupReleases(commits)
  const tagged = releases.some((release) => release.version !== null)
  const message = shallow ? SHALLOW_MESSAGE : tagged ? '' : NO_TAGS_MESSAGE
  return { appVersion, status: shallow ? 'shallow' : 'ok', message, releases }
}

export const releaseAnchor = (release: Release): string =>
  release.version === null ? 'unreleased' : `release-v${release.version.replaceAll('.', '-')}`

export const releaseTitle = (release: Release): string => (release.version === null ? 'Unreleased' : release.tag!)

const entryLabel = (entry: ReleaseEntry): string =>
  `${entry.breaking ? 'BREAKING ' : ''}${entry.scope === null ? '' : `${entry.scope}: `}${entry.text}`

/** Plain text for agents (/releases.txt): no markup, short sha plus subject, no links beyond the repo header. */
export const renderReleasesText = (data: ReleaseData): string => {
  const lines = [
    'Seshat release notes',
    `Current version: ${data.appVersion}`,
    `Source: ${GITHUB_URL} and ${GITLAB_URL}`,
    'Generated from git history (conventional commits) at build time.',
    '',
  ]
  if (data.message !== '') lines.push(`Note: ${data.message}`, '')
  for (const release of data.releases) {
    lines.push(release.date === null ? releaseTitle(release) : `${releaseTitle(release)} (${release.date})`)
    for (const section of release.sections) {
      lines.push(`  ${section.title}`)
      for (const entry of section.entries) lines.push(`    - ${entryLabel(entry)} [${entry.short}]`)
    }
    lines.push('')
  }
  return `${lines.join('\n').trimEnd()}\n`
}

const markdownEntry = (entry: ReleaseEntry): string => {
  const scope = entry.scope === null ? '' : `**${entry.scope}:** `
  const links = `[${entry.short}](${githubCommitUrl(entry.sha)}) · [GitLab](${gitlabCommitUrl(entry.sha)})`
  return `- ${entry.breaking ? '**BREAKING** ' : ''}${scope}${entry.text} (${links})`
}

/** One release as a Markdown block (the unit `just release` prepends to CHANGELOG.md). */
export const renderReleaseMarkdown = (release: Release): string => {
  const heading =
    release.date === null ? `## ${releaseTitle(release)}` : `## ${releaseTitle(release)} - ${release.date}`
  const sections = release.sections.map((section) =>
    [`### ${section.title}`, '', ...section.entries.map(markdownEntry)].join('\n'),
  )
  return [heading, '', ...sections.flatMap((s) => [s, ''])].join('\n').trimEnd() + '\n'
}

/** Whole changelog for agents (/CHANGELOG.md), Unreleased first. */
export const renderChangelogMarkdown = (data: ReleaseData): string => {
  const head = ['# Changelog', '', `Current version: ${data.appVersion}. Generated from git history at build time.`, '']
  if (data.message !== '') head.push(`> ${data.message}`, '')
  return `${[...head, ...data.releases.map(renderReleaseMarkdown).flatMap((block) => [block])].join('\n').trimEnd()}\n`
}

export type BumpKind = 'patch' | 'minor' | 'major'

/** `bumpVersion('0.1.9', 'minor')` -> `0.2.0`. Throws on anything that is not plain `X.Y.Z`. */
export const bumpVersion = (version: string, kind: BumpKind): string => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (match === null) throw new Error(`not a plain X.Y.Z version: ${version}`)
  const [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])] as const
  if (kind === 'major') return `${major + 1}.0.0`
  if (kind === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

/** Highest `vX.Y.Z` among a list of tag names, or `null` when none. */
export const latestVersionTag = (tags: readonly string[]): string | null =>
  tags
    .map((tag) => SEMVER_TAG.exec(tag)?.[1])
    .filter((v): v is string => v !== undefined)
    .sort((a, b) => compareVersions(b, a))[0] ?? null
