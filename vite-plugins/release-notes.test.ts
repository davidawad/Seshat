import { describe, expect, it } from 'vitest'
import { type GitRunner, execGit, readReleaseData } from './release-notes.ts'

const log = (rows: readonly (readonly [string, string, string, string])[]): string =>
  rows.map((row) => `${row.join('\x1f')}\x1e`).join('\n')

const fakeGit =
  (logOut: string | null, shallow: string | null): GitRunner =>
  (args) =>
    args[0] === 'log' ? logOut : args[0] === 'rev-parse' ? shallow : null

describe('readReleaseData', () => {
  it('reads tagged history from git output', () => {
    const out = log([
      ['bbbbbbb1', '2026-02-02T00:00:00+00:00', 'HEAD -> main', 'feat: later'],
      ['aaaaaaa1', '2026-01-01T00:00:00+00:00', 'tag: v0.1.0', 'fix: earlier'],
    ])
    const data = readReleaseData(fakeGit(out, 'false\n'), '0.1.0')
    expect(data.status).toBe('ok')
    expect(data.releases.map((r) => r.version)).toEqual([null, '0.1.0'])
  })

  it('flags a shallow clone', () => {
    const out = log([['bbbbbbb1', '2026-02-02T00:00:00+00:00', '', 'feat: x']])
    expect(readReleaseData(fakeGit(out, 'true\n'), '0.1.0').status).toBe('shallow')
  })

  it('degrades when git is unavailable', () => {
    const data = readReleaseData(fakeGit(null, null), '0.1.0')
    expect(data).toMatchObject({ status: 'no-git', releases: [] })
    expect(data.message).not.toBe('')
  })
})

describe('execGit', () => {
  it('returns null instead of throwing when the command fails', () => {
    expect(execGit('/definitely/not/a/directory')(['log'])).toBeNull()
  })
})
