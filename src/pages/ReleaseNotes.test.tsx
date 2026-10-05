import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../App'
import { type RawCommit, buildReleaseData } from '../lib/releases'
import { SeshatProvider } from '../lib/store'
import { TESTIDS } from '../lib/testids'
import { ReleaseNotesView } from './ReleaseNotesView'

const commit = (n: number, subject: string, refs = ''): RawCommit => ({
  sha: `${n}${'0'.repeat(39)}`,
  date: `2026-03-0${n}T00:00:00+00:00`,
  refs,
  subject,
})

const data = buildReleaseData({
  appVersion: '0.2.0',
  shallow: false,
  commits: [
    commit(4, 'feat(sets): shiny'),
    commit(3, 'test: cover it', 'tag: v0.2.0'),
    commit(2, 'fix(a11y): focus'),
    commit(1, 'feat: first', 'tag: v0.1.0'),
  ],
})

afterEach(cleanup)

describe('ReleaseNotesView', () => {
  it('has one h1, a section per release with Unreleased first, and dated headings', () => {
    render(<ReleaseNotesView data={data} />)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Release notes' })).toBeInTheDocument()
    const releases = screen.getAllByTestId(TESTIDS.releasesRelease)
    expect(releases.map((r) => within(r).getByRole('heading', { level: 2 }).textContent)).toEqual([
      'Unreleased #',
      'v0.2.0 2026-03-03 #',
      'v0.1.0 2026-03-01 #',
    ])
    expect(screen.getByText('2026-03-03').tagName).toBe('TIME')
    expect(screen.getByTestId(TESTIDS.releasesVersion)).toHaveTextContent('0.2.0')
  })

  it('links anchors, commits on both hosts, and collapses maintenance', () => {
    render(<ReleaseNotesView data={data} />)
    expect(screen.getByRole('link', { name: 'Link to v0.2.0' })).toHaveAttribute('href', '#release-v0-2-0')
    expect(screen.getAllByRole('link', { name: /on GitHub$/ })[0]).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:\/\/github\.com\/davidawad\/Seshat\/commit\/4/),
    )
    expect(screen.getAllByRole('link', { name: /on GitLab$/ })[0]).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:\/\/gitlab\.com\/davidawad\/seshat\/-\/commit\/4/),
    )
    expect(screen.getByText(/Maintenance \(1\)/).closest('details')).not.toHaveAttribute('open')
    expect(screen.getAllByRole('list').length).toBeGreaterThan(0)
    expect(screen.queryByTestId(TESTIDS.releasesNotice)).toBeNull()
  })

  it('shows a status message when history is missing', () => {
    render(<ReleaseNotesView data={buildReleaseData({ appVersion: '0.1.0', commits: null, shallow: false })} />)
    expect(screen.getByRole('status')).toHaveTextContent(/git was not available/)
    expect(screen.queryAllByTestId(TESTIDS.releasesRelease)).toHaveLength(0)
  })
})

describe('/releases route', () => {
  it('lazy-loads the page and shows the footer link and version', async () => {
    render(
      <SeshatProvider>
        <MemoryRouter initialEntries={['/releases']}>
          <App />
        </MemoryRouter>
      </SeshatProvider>,
    )
    expect(await screen.findByTestId(TESTIDS.releasesPage)).toBeInTheDocument()
    expect(screen.getByTestId(TESTIDS.footerReleases)).toHaveAttribute('href', '/releases')
    expect(screen.getByTestId(TESTIDS.footerVersion)).toHaveTextContent(/^v\d+\.\d+\.\d+$/)
  })
})
