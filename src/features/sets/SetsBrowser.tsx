import { type ReactNode, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSeshatStore } from '../../lib/store'
import { useDebouncedValue } from '../../lib/use-debounced-value'
import { TESTIDS } from '../../lib/testids'
import type { ExportedSet, Folder, HomeView, StudySet } from '../../types'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { folderTrail } from './folder-trail'
import { setMatchesQuery } from './filters'
import { type SetMastery, summarizeMastery } from './set-summary'
import { SetProgressCard } from './SetProgressCard'
import { FoldersSection } from './FoldersSection'
import { FirstRunHero } from './FirstRunHero'
import { SetsHeader } from './SetsBrowserHeader'
import { SetTable } from './SetTable'
import './sets.css'
import './sets-browser.css'

interface SetsBrowserProps {
  /** The page heading: "Your sets" on Home, "Sets" on /sets. The only thing the two pages differ by. */
  readonly title: string
  /**
   * Show only this folder's sets. A folder is just a set list: the page is identical, scoped, with
   * a Remove button per set. With no folder this is the whole library (the root list).
   */
  readonly folder?: Folder
  /** Folder-only controls and stats rendered under the list (rename, add a set, folder stats). */
  readonly children?: ReactNode
}

/** How long typing must pause before the search is applied. */
const SEARCH_DEBOUNCE_MS = 150

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

const SetGrid = ({
  rows,
  linkState,
  onRemove,
}: {
  readonly rows: readonly BrowserRow[]
  readonly linkState?: unknown
  readonly onRemove?: ((set: StudySet) => void) | undefined
}) => (
  <ul className="home-set-grid" data-testid={TESTIDS.setsBrowserGrid}>
    {rows.map(({ set, mastery }) => (
      <li key={set.id}>
        <SetProgressCard
          set={set}
          mastery={mastery}
          linkState={linkState}
          onRemove={onRemove === undefined ? undefined : () => onRemove(set)}
        />
      </li>
    ))}
    <li>
      <NewSetTile />
    </li>
  </ul>
)

interface SetsListProps {
  readonly rows: readonly BrowserRow[]
  /** The library (or folder) has no sets at all, as opposed to none matching the search. */
  readonly isEmpty: boolean
  readonly inFolder: boolean
  readonly search: string
  readonly view: HomeView
  readonly linkState: unknown
  readonly onRemove: ((set: StudySet) => void) | undefined
  readonly onLoadStarter: (exported: ExportedSet) => void
}

/** What sits under the heading row: the first-run hero, an empty note, or the sets as a table or card grid. */
const SetsList = ({ rows, isEmpty, inFolder, search, view, linkState, onRemove, onLoadStarter }: SetsListProps) => {
  if (isEmpty)
    return inFolder ? <p>No sets in this folder yet. Add one below.</p> : <FirstRunHero onLoad={onLoadStarter} />
  if (rows.length === 0) return <p>No sets match &quot;{search}&quot;.</p>
  return view === 'table' ? (
    <SetTable rows={rows} linkState={linkState} onRemove={onRemove} />
  ) : (
    <SetGrid rows={rows} linkState={linkState} onRemove={onRemove} />
  )
}

/**
 * Your sets, one component for both `/` and `/sets`: heading row (title, cards/table
 * toggle, search, Create / Import), then the card grid or the table, or the first-run hero
 * when there are none. The two pages differ only by `title`.
 */
export const SetsBrowser = ({ title, folder, children }: SetsBrowserProps) => {
  const { state, importSet, updateSettings, setFolderMembership } = useSeshatStore()
  const navigate = useNavigate()
  const headingId = useId()
  const [query, setQuery] = useState('')
  const search = useDebouncedValue(query, SEARCH_DEBOUNCE_MS)
  const now = new Date()

  const scoped = folder === undefined ? state.sets : state.sets.filter((set) => folder.setIds.includes(set.id))
  const linkState = folder === undefined ? undefined : folderTrail(folder.id)
  const onRemove = folder === undefined ? undefined : (set: StudySet) => setFolderMembership(folder.id, set.id, false)

  const rows: BrowserRow[] = scoped
    .map((set) => ({ set, cards: state.cards.filter((card) => card.setId === set.id) }))
    .filter(({ set, cards }) => setMatchesQuery(set, cards, search))
    .map(({ set, cards }) => ({ set, mastery: summarizeMastery(cards, now) }))

  const handleLoadStarter = (exported: ExportedSet) => {
    const set = importSet(exported, 'sample')
    navigate(`/sets/${set.id}`)
  }

  const hasSets = scoped.length > 0
  const view = state.settings.homeView

  return (
    <section aria-labelledby={headingId} data-testid={TESTIDS.setsBrowser}>
      {folder !== undefined && <Breadcrumbs crumbs={[{ label: 'Sets', to: '/sets' }]} />}
      <SetsHeader
        headingId={headingId}
        title={title}
        showControls={hasSets}
        view={view}
        onViewChange={(homeView) => updateSettings({ homeView })}
        query={query}
        onQueryChange={setQuery}
      />
      <SetsList
        rows={rows}
        isEmpty={!hasSets}
        inFolder={folder !== undefined}
        search={search}
        view={view}
        linkState={linkState}
        onRemove={onRemove}
        onLoadStarter={handleLoadStarter}
      />
      {folder === undefined && hasSets && <FoldersSection />}
      {children}
    </section>
  )
}
