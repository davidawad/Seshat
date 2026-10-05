import { describe, expect, it } from 'vitest'
import {
  type RawCommit,
  NO_GIT_MESSAGE,
  NO_TAGS_MESSAGE,
  SHALLOW_MESSAGE,
  buildReleaseData,
  bumpVersion,
  groupReleases,
  isMergeNoise,
  latestVersionTag,
  parseGitLog,
  parseSubject,
  releaseAnchor,
  renderChangelogMarkdown,
  renderReleaseMarkdown,
  renderReleasesText,
  sectionFor,
  tagVersions,
} from './releases'

const commit = (
  n: number,
  subject: string,
  refs = '',
  date = `2026-01-${String(n).padStart(2, '0')}T10:00:00+00:00`,
): RawCommit => ({
  sha: `${String(n).padStart(2, '0')}abcdef0123456789abcdef0123456789abcdef`.slice(0, 40),
  date,
  refs,
  subject,
})

describe('tagVersions', () => {
  it('keeps only vX.Y.Z tags', () => {
    expect(tagVersions('HEAD -> main, tag: v1.2.3, tag: nightly, origin/main, tag: v1.2.3-rc1')).toEqual(['1.2.3'])
    expect(tagVersions('')).toEqual([])
  })
})

describe('isMergeNoise', () => {
  it('drops merges, landing merges and release commits only', () => {
    expect(isMergeNoise('chore: merge sets-pages into candidate (land)')).toBe(true)
    expect(isMergeNoise("Merge branch 'x' into main")).toBe(true)
    expect(isMergeNoise('chore(release): v0.2.0')).toBe(true)
    expect(isMergeNoise('chore: merge helper utilities')).toBe(false)
    expect(isMergeNoise('feat: merge sets')).toBe(false)
  })
})

describe('parseSubject / sectionFor', () => {
  it('strips type and scope, capitalises, flags breaking', () => {
    expect(parseSubject('feat(sets)!: in-app confirm dialog')).toEqual({
      type: 'feat',
      scope: 'sets',
      breaking: true,
      text: 'In-app confirm dialog',
    })
  })

  it('treats non-conventional subjects as untyped maintenance', () => {
    const parsed = parseSubject('tidy things up')
    expect(parsed).toMatchObject({ type: null, scope: null, text: 'Tidy things up' })
    expect(sectionFor(parsed)).toBe('maintenance')
  })

  it('maps types to sections, with the a11y scope winning', () => {
    const kind = (s: string) => sectionFor(parseSubject(s))
    expect(kind('feat: x')).toBe('features')
    expect(kind('fix: x')).toBe('fixes')
    expect(kind('perf: x')).toBe('performance')
    expect(kind('fix(a11y): x')).toBe('accessibility')
    expect(kind('feat(a11y): x')).toBe('accessibility')
    for (const type of ['test', 'chore', 'refactor', 'docs', 'build', 'ci', 'style']) {
      expect(kind(`${type}: x`)).toBe('maintenance')
    }
  })
})

describe('groupReleases', () => {
  const log = [
    commit(9, 'feat(learn): adaptive mode'),
    commit(8, 'chore: merge a into candidate (land)'),
    commit(7, 'fix(a11y): focus the heading', 'HEAD -> main'),
    commit(6, 'perf: lazy-load editors', 'tag: v0.2.0'),
    commit(5, 'fix: overflow at phone width'),
    commit(4, 'test(e2e): add property spec'),
    commit(3, 'feat: first thing', 'tag: v0.1.0'),
  ]

  it('puts commits above the newest tag under Unreleased, first', () => {
    const [unreleased, second, third] = groupReleases(log)
    expect(unreleased).toMatchObject({ version: null, tag: null, date: null })
    expect(unreleased?.sections.map((s) => s.kind)).toEqual(['features', 'accessibility'])
    expect(second).toMatchObject({ version: '0.2.0', tag: 'v0.2.0', date: '2026-01-06' })
    expect(second?.sections.map((s) => s.kind)).toEqual(['fixes', 'performance', 'maintenance'])
    expect(third).toMatchObject({ version: '0.1.0', date: '2026-01-03' })
  })

  it('omits Unreleased when nothing is pending and drops merge noise', () => {
    const releases = groupReleases([commit(2, 'chore: merge x (land)', 'tag: v1.0.0'), commit(1, 'feat: a')])
    expect(releases).toHaveLength(1)
    expect(releases[0]?.version).toBe('1.0.0')
    expect(releases[0]?.sections.flatMap((s) => s.entries.map((e) => e.text))).toEqual(['A'])
  })

  it('shows every change under Unreleased when no tag exists', () => {
    const releases = groupReleases([commit(2, 'fix: b'), commit(1, 'feat: a')])
    expect(releases.map((r) => r.version)).toEqual([null])
  })

  it('labels scopes, hides the redundant a11y label, and carries only sha and text', () => {
    const [release] = groupReleases([commit(2, 'fix(a11y): x'), commit(1, 'feat(sets)!: y')])
    const entries = release!.sections.flatMap((s) => s.entries)
    expect(entries.map((e) => [e.scope, e.breaking, e.short])).toEqual([
      ['sets', true, '01abcde'],
      [null, false, '02abcde'],
    ])
    expect(Object.keys(entries[0]!).sort()).toEqual(['breaking', 'scope', 'sha', 'short', 'text'])
  })

  it('picks the highest tag when one commit has several', () => {
    const [release] = groupReleases([commit(1, 'feat: a', 'tag: v1.0.0, tag: v1.1.0')])
    expect(release?.version).toBe('1.1.0')
  })
})

describe('parseGitLog', () => {
  it('reads US/RS separated records without needing author fields', () => {
    const out =
      'aaa\x1f2026-01-01T00:00:00+00:00\x1fHEAD -> main, tag: v1.0.0\x1ffeat: one\x1e\nbbb\x1f2026-01-02T00:00:00+00:00\x1f\x1ffix: two\x1e\n'
    expect(parseGitLog(out)).toEqual([
      { sha: 'aaa', date: '2026-01-01T00:00:00+00:00', refs: 'HEAD -> main, tag: v1.0.0', subject: 'feat: one' },
      { sha: 'bbb', date: '2026-01-02T00:00:00+00:00', refs: '', subject: 'fix: two' },
    ])
    expect(parseGitLog('')).toEqual([])
  })
})

describe('buildReleaseData', () => {
  const commits = [commit(1, 'feat: a')]
  it('degrades with a clear message when git or history is missing', () => {
    expect(buildReleaseData({ appVersion: '0.1.0', commits: null, shallow: false })).toMatchObject({
      status: 'no-git',
      message: NO_GIT_MESSAGE,
      releases: [],
    })
    expect(buildReleaseData({ appVersion: '0.1.0', commits: [], shallow: false }).status).toBe('no-git')
  })

  it('explains shallow clones and missing tags, and is quiet when all is well', () => {
    expect(buildReleaseData({ appVersion: '0.1.0', commits, shallow: true })).toMatchObject({
      status: 'shallow',
      message: SHALLOW_MESSAGE,
    })
    expect(buildReleaseData({ appVersion: '0.1.0', commits, shallow: false }).message).toBe(NO_TAGS_MESSAGE)
    const tagged = [commit(2, 'feat: b', 'tag: v0.1.0')]
    expect(buildReleaseData({ appVersion: '0.1.0', commits: tagged, shallow: false })).toMatchObject({
      status: 'ok',
      message: '',
    })
  })
})

describe('rendering', () => {
  const data = buildReleaseData({
    appVersion: '0.2.0',
    shallow: false,
    commits: [commit(3, 'feat(sets): new thing'), commit(2, 'fix: old bug', 'tag: v0.2.0')],
  })

  it('anchors releases', () => {
    expect(data.releases.map(releaseAnchor)).toEqual(['unreleased', 'release-v0-2-0'])
  })

  it('renders plain text with Unreleased first', () => {
    const text = renderReleasesText(data)
    expect(text.indexOf('Unreleased')).toBeLessThan(text.indexOf('v0.2.0 (2026-01-02)'))
    expect(text).toContain('- sets: New thing [03abcde]')
    expect(text).toContain('Current version: 0.2.0')
  })

  it('renders Markdown with GitHub and GitLab commit links', () => {
    const md = renderChangelogMarkdown(data)
    expect(md).toContain('## v0.2.0 - 2026-01-02')
    expect(md).toContain('https://github.com/davidawad/Seshat/commit/03abcdef')
    expect(md).toContain('https://gitlab.com/davidawad/seshat/-/commit/03abcdef')
    expect(renderReleaseMarkdown(data.releases[0]!).startsWith('## Unreleased\n')).toBe(true)
  })

  it('includes a note line when history is incomplete', () => {
    const none = buildReleaseData({ appVersion: '0.1.0', commits: null, shallow: false })
    expect(renderChangelogMarkdown(none)).toContain(`> ${NO_GIT_MESSAGE}`)
    expect(renderReleasesText(none)).toContain(`Note: ${NO_GIT_MESSAGE}`)
  })
})

describe('versions', () => {
  it('bumps patch, minor and major', () => {
    expect(bumpVersion('0.1.9', 'patch')).toBe('0.1.10')
    expect(bumpVersion('0.1.9', 'minor')).toBe('0.2.0')
    expect(bumpVersion('0.1.9', 'major')).toBe('1.0.0')
    expect(() => bumpVersion('1.0', 'patch')).toThrow('not a plain')
  })

  it('finds the highest semver tag numerically', () => {
    expect(latestVersionTag(['v0.9.0', 'v0.10.0', 'nightly', 'v0.2.1'])).toBe('0.10.0')
    expect(latestVersionTag(['nightly'])).toBeNull()
  })
})
