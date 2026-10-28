import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { SetProgressCard } from '../features/sets/SetProgressCard'
import { SetsBrowser } from '../features/sets/SetsBrowser'
import { type SetMastery, summarizeMastery } from '../features/sets/set-summary'
import { folderSetIds, scopeToSets, summarizeScope } from '../features/stats/scope'
import { useSeshatStore } from '../lib/store'
import { TESTIDS } from '../lib/testids'
import type { StudySet } from '../types'
import '../features/sets/folders-page.css'
import '../features/sets/sets.css'
import '../features/sets/sets-browser.css'
import './dashboard.css'

/** How many sets and folders the landing page previews before pointing at the full pages. */
const PREVIEW_SETS = 6
const PREVIEW_FOLDERS = 4

interface RankedSet {
  readonly set: StudySet
  readonly mastery: SetMastery
}

/** Most overdue first, then most unstudied, then A to Z: what to open next. */
const byUrgency = (a: RankedSet, b: RankedSet): number =>
  b.mastery.due - a.mastery.due || b.mastery.newCount - a.mastery.newCount || a.set.name.localeCompare(b.set.name)

const longDate = (now: Date): string =>
  now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

const UpNext = ({ pick }: { readonly pick: RankedSet | null }) => {
  if (pick === null || pick.mastery.due + pick.mastery.newCount === 0) {
    return (
      <div className="dash-panel dash-next" data-testid={TESTIDS.dashNext}>
        <span className="dash-caption">Up next</span>
        <p className="dash-next-name">All caught up</p>
        <p className="dash-next-meta">Nothing is due. Add something new, or revisit a set any time.</p>
        <div className="dash-next-actions">
          <Link to="/sets/browse" className="dash-button is-primary">
            Browse sets
          </Link>
          <Link to="/sets/new" className="dash-button">
            Create a set
          </Link>
        </div>
      </div>
    )
  }
  const { set, mastery } = pick
  const percent = mastery.total === 0 ? 0 : Math.round((mastery.memorized / mastery.total) * 100)
  return (
    <div className="dash-panel dash-next" data-testid={TESTIDS.dashNext}>
      <span className="dash-caption">Up next</span>
      <Link to={`/sets/${set.id}`} className="dash-next-name">
        {set.name}
      </Link>
      <p className="dash-next-meta">
        {mastery.due} due · {mastery.newCount} new · {mastery.total} cards
      </p>
      <div
        className="dash-bar"
        role="progressbar"
        aria-label={`${set.name} ${percent}% memorized`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ inlineSize: `${percent}%` }} />
      </div>
      <div className="dash-next-actions">
        <Link to={`/sets/${set.id}/study`} className="dash-button is-primary" data-testid={TESTIDS.dashStudy}>
          Study now
        </Link>
        <Link to={`/sets/${set.id}`} className="dash-button">
          Open set
        </Link>
      </div>
    </div>
  )
}

/** Returning learners land on today's work. Someone with no sets yet still gets the first-run welcome. */
export const HomePage = () => {
  const { state } = useSeshatStore()
  const now = useMemo(() => new Date(), [])

  const ranked = useMemo<RankedSet[]>(
    () =>
      state.sets
        .map((set) => ({
          set,
          mastery: summarizeMastery(
            state.cards.filter((card) => card.setId === set.id),
            now,
          ),
        }))
        .sort(byUrgency),
    [state.sets, state.cards, now],
  )
  const totals = useMemo(() => summarizeScope({ cards: state.cards, reviewLog: state.reviewLog }, now), [state, now])
  const folders = useMemo(
    () =>
      state.folders.slice(0, PREVIEW_FOLDERS).map((folder) => ({
        folder,
        summary: summarizeScope(scopeToSets(state, folderSetIds(folder)), now),
      })),
    [state, now],
  )

  if (state.sets.length === 0) return <SetsBrowser title="Your sets" />

  return (
    <section aria-labelledby="dash-heading" data-testid={TESTIDS.dashPage} className="dash">
      <p className="dash-date">{longDate(now)}</p>
      <h1 id="dash-heading">Today</h1>

      <div className="dash-top">
        <UpNext pick={ranked[0] ?? null} />
        <dl className="dash-panel dash-tiles" data-testid={TESTIDS.statsSummary}>
          <div>
            <dt>Due now</dt>
            <dd>{totals.due}</dd>
          </div>
          <div>
            <dt>New cards</dt>
            <dd>{totals.newCount}</dd>
          </div>
          <div>
            <dt>Reviewed today</dt>
            <dd>{totals.reviewedToday}</dd>
          </div>
        </dl>
      </div>

      <div className="dash-section-head">
        <h2>Your sets</h2>
        <Link to="/sets">All sets ({state.sets.length})</Link>
      </div>
      <ul className="home-set-grid dash-grid">
        {ranked.slice(0, PREVIEW_SETS).map(({ set, mastery }) => (
          <li key={set.id}>
            <SetProgressCard set={set} mastery={mastery} />
          </li>
        ))}
      </ul>

      {folders.length > 0 && (
        <>
          <div className="dash-section-head">
            <h2>Folders</h2>
            <Link to="/folders">All folders ({state.folders.length})</Link>
          </div>
          <ul className="folders-grid">
            {folders.map(({ folder, summary }) => (
              <li key={folder.id}>
                <Link to={`/sets/folders/${folder.id}`} className="folders-panel">
                  <span className="folders-caption">Folder</span>
                  <span className="folders-panel-name">{folder.name}</span>
                  <span className="folders-panel-meta">
                    {folder.setIds.length} set{folder.setIds.length === 1 ? '' : 's'} · {summary.cardCount} cards
                  </span>
                  <span className="folders-panel-stats">
                    <span className={summary.due > 0 ? 'folders-pill is-due' : 'folders-pill'}>{summary.due} due</span>
                    <span className="folders-pill">{summary.newCount} new</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
