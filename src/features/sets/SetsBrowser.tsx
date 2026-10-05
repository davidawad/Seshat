import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import type { StudySet } from '../../types'
import { setMatchesQuery } from './filters'
import { type SetMastery, summarizeMastery } from './set-summary'
import { SetProgressCard } from './SetProgressCard'
import { SetsHeader } from './SetsBrowserHeader'
import { SetTable } from './SetTable'
import { type StarterSet, STARTER_SETS } from './starter-sets'
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

const StarterLoaders = ({ onLoad }: { readonly onLoad: (starter: StarterSet) => void }) => (
  <div>
    <p>You don&apos;t have any sets yet. Start from a test set, or create or import your own.</p>
    <ul className="starter-set-list">
      {STARTER_SETS.map((starter) => (
        <li key={starter.id}>
          <button type="button" data-testid={TESTIDS.setsBrowserStarterLoad} onClick={() => onLoad(starter)}>
            Load: {starter.label}
          </button>
        </li>
      ))}
    </ul>
  </div>
)

/**
 * Your sets, one component for both `/` and `/sets`: heading row (title, cards/table
 * toggle, search, Create / Import), then the card grid or the table, or starter sets
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

  const handleLoadStarter = (starter: StarterSet) => {
    const set = importSet(starter.set)
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
        <StarterLoaders onLoad={handleLoadStarter} />
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
