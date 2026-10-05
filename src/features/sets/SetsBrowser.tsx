import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import type { ExportedSet, StudySet } from '../../types'
import { setMatchesQuery } from './filters'
import { type SetMastery, summarizeMastery } from './set-summary'
import { SetProgressCard } from './SetProgressCard'
import { FirstRunHero } from './FirstRunHero'
import { SetsHeader } from './SetsBrowserHeader'
import { SetTable } from './SetTable'
import './sets.css'
import './sets-browser.css'

interface SetsBrowserProps {
  /** The page heading: "Your sets" on Home, "Sets" on /sets. The only thing the two pages differ by. */
  readonly title: string
}

interface BrowserRow {
  readonly set: StudySet
  readonly mastery: SetMastery
}

const NewSetTile = () => (
  <Link to="/sets/new" className="new-set-tile" data-testid={TESTIDS.setsBrowserNewSet}>
    <span className="new-set-tile-plus" aria-hidden="true">
      +
    </span>
    <span>New set</span>
  </Link>
)

const SetGrid = ({ rows }: { readonly rows: readonly BrowserRow[] }) => (
  <ul className="home-set-grid" data-testid={TESTIDS.setsBrowserGrid}>
    {rows.map(({ set, mastery }) => (
      <li key={set.id}>
        <SetProgressCard set={set} mastery={mastery} />
      </li>
    ))}
    <li>
      <NewSetTile />
    </li>
  </ul>
)

/**
 * Your sets, one component for both `/` and `/sets`: heading row (title, cards/table
 * toggle, search, Create / Import), then the card grid or the table, or the first-run hero
 * when there are none. The two pages differ only by `title`.
 */
export const SetsBrowser = ({ title }: SetsBrowserProps) => {
  const { state, importSet, updateSettings } = useSeshatStore()
  const navigate = useNavigate()
  const headingId = useId()
  const [query, setQuery] = useState('')
  const now = new Date()

  const rows: BrowserRow[] = state.sets
    .map((set) => ({ set, cards: state.cards.filter((card) => card.setId === set.id) }))
    .filter(({ set, cards }) => setMatchesQuery(set, cards, query))
    .map(({ set, cards }) => ({ set, mastery: summarizeMastery(cards, now) }))

  const handleLoadStarter = (exported: ExportedSet) => {
    const set = importSet(exported)
    navigate(`/sets/${set.id}`)
  }

  const hasSets = state.sets.length > 0
  const view = state.settings.homeView

  return (
    <section aria-labelledby={headingId} data-testid={TESTIDS.setsBrowser}>
      <SetsHeader
        headingId={headingId}
        title={title}
        showControls={hasSets}
        view={view}
        onViewChange={(homeView) => updateSettings({ homeView })}
        query={query}
        onQueryChange={setQuery}
      />
      {!hasSets ? (
        <FirstRunHero onLoad={handleLoadStarter} />
      ) : rows.length === 0 ? (
        <p>No sets match &quot;{query}&quot;.</p>
      ) : view === 'table' ? (
        <SetTable rows={rows} />
      ) : (
        <SetGrid rows={rows} />
      )}
    </section>
  )
}
