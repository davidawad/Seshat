import { Link } from 'react-router-dom'
import { TESTIDS } from '../../lib/testids'
import type { HomeView } from '../../types'
import { SetViewToggle } from './SetViewToggle'

interface SetsHeaderProps {
  readonly headingId: string
  readonly title: string
  /** Toggle and search only make sense once there is something to show. */
  readonly showControls: boolean
  readonly view: HomeView
  readonly onViewChange: (view: HomeView) => void
  readonly query: string
  readonly onQueryChange: (query: string) => void
}

/** Heading row: title, cards/table toggle, search, and the Create / Import links. */
export const SetsHeader = ({
  headingId,
  title,
  showControls,
  view,
  onViewChange,
  query,
  onQueryChange,
}: SetsHeaderProps) => (
  <div className="sets-header">
    <h1 id={headingId}>{title}</h1>
    {showControls && <SetViewToggle value={view} onChange={onViewChange} />}
    {showControls && (
      <input
        type="search"
        className="sets-header-search"
        data-testid={TESTIDS.setsBrowserSearch}
        aria-label="Search sets"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search by name, tag, or card content"
      />
    )}
    <div className="sets-header-actions">
      <Link to="/sets/new" className="primary-link" data-testid={TESTIDS.setsBrowserCreate}>
        Create
      </Link>
      <Link to="/sets/import" className="secondary-link" data-testid={TESTIDS.setsBrowserImport}>
        Import
      </Link>
    </div>
  </div>
)
