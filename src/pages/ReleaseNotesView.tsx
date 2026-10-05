import {
  type Release,
  type ReleaseData,
  type ReleaseEntry,
  type ReleaseSection,
  GITHUB_URL,
  GITLAB_URL,
  githubCommitUrl,
  gitlabCommitUrl,
  releaseAnchor,
  releaseTitle,
} from '../lib/releases'
import { TESTIDS } from '../lib/testids'
import './release-notes.css'

const Entry = ({ entry }: { readonly entry: ReleaseEntry }) => (
  <li className="release-entry" data-testid={TESTIDS.releasesEntry}>
    {entry.breaking && <strong className="release-breaking">Breaking </strong>}
    {entry.scope !== null && <span className="release-scope">{entry.scope}</span>}
    <span>{entry.text}</span>{' '}
    <span className="release-commit">
      <a href={githubCommitUrl(entry.sha)} aria-label={`Commit ${entry.short} on GitHub`}>
        {entry.short}
      </a>
      {' · '}
      <a href={gitlabCommitUrl(entry.sha)} aria-label={`Commit ${entry.short} on GitLab`}>
        GitLab
      </a>
    </span>
  </li>
)

const Section = ({ section, anchor }: { readonly section: ReleaseSection; readonly anchor: string }) => {
  const list = (
    <ul className="release-list">
      {section.entries.map((entry) => (
        <Entry key={entry.sha} entry={entry} />
      ))}
    </ul>
  )
  const headingId = `${anchor}-${section.kind}`
  // Maintenance (refactors, tests, chores) is real but rarely what a reader is after: collapsed by default.
  return section.kind === 'maintenance' ? (
    <details className="release-maintenance">
      <summary>
        {section.title} ({section.entries.length})
      </summary>
      {list}
    </details>
  ) : (
    <section aria-labelledby={headingId}>
      <h3 id={headingId}>{section.title}</h3>
      {list}
    </section>
  )
}

const ReleaseBlock = ({ release }: { readonly release: Release }) => {
  const anchor = releaseAnchor(release)
  const title = releaseTitle(release)
  return (
    <section aria-labelledby={anchor} className="release" data-testid={TESTIDS.releasesRelease}>
      <h2 id={anchor}>
        {title}
        {release.date !== null && (
          <>
            {' '}
            <time className="release-date" dateTime={release.date}>
              {release.date}
            </time>
          </>
        )}{' '}
        <a className="release-anchor" href={`#${anchor}`} aria-label={`Link to ${title}`}>
          #
        </a>
      </h2>
      {release.sections.length === 0 ? (
        <p>No changes recorded.</p>
      ) : (
        release.sections.map((section) => <Section key={section.kind} section={section} anchor={anchor} />)
      )}
    </section>
  )
}

/** The presentational half, fed plain data so tests (and any other source) can drive it. */
export const ReleaseNotesView = ({ data }: { readonly data: ReleaseData }) => (
  <section aria-labelledby="releases-heading" data-testid={TESTIDS.releasesPage}>
    <h1 id="releases-heading">Release notes</h1>
    <p>
      Current version <strong data-testid={TESTIDS.releasesVersion}>{data.appVersion}</strong>. Generated from the{' '}
      <a href={GITHUB_URL}>git history</a> (also on <a href={GITLAB_URL}>GitLab</a>) every time the site is built, so it
      never goes stale. Agents can read <a href={`${import.meta.env.BASE_URL}releases.txt`}>releases.txt</a> or{' '}
      <a href={`${import.meta.env.BASE_URL}CHANGELOG.md`}>CHANGELOG.md</a>.
    </p>
    {data.message !== '' && (
      <p role="status" className="release-note" data-testid={TESTIDS.releasesNotice}>
        {data.message}
      </p>
    )}
    {data.releases.map((release) => (
      <ReleaseBlock key={release.tag ?? 'unreleased'} release={release} />
    ))}
  </section>
)
