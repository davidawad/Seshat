import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import { setMatchesQuery } from './filters'
import './sets.css'
import { SetListItem } from './SetListItem'
import { type StarterSet, STARTER_SETS } from './starter-sets'

export const SetListPage = () => {
  const { state, importSet } = useSeshatStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const filteredSets = state.sets.filter((set) =>
    setMatchesQuery(
      set,
      state.cards.filter((card) => card.setId === set.id),
      query,
    ),
  )

  const handleLoadStarter = (starter: StarterSet) => {
    const set = importSet(starter.set)
    navigate(`/sets/${set.id}`)
  }

  return (
    <section aria-labelledby="sets-heading" data-testid={TESTIDS.setsPage}>
      <header className="sets-header">
        <h1 id="sets-heading">Sets</h1>
        {state.sets.length > 0 && (
          <input
            type="search"
            className="sets-header-search"
            data-testid={TESTIDS.setsSearch}
            aria-label="Search sets"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, tag, or card content"
          />
        )}
        <div className="sets-header-actions">
          <Link to="/sets/new" className="primary-link" data-testid={TESTIDS.setsNewButton}>
            Create
          </Link>
          <Link to="/sets/import" className="secondary-link" data-testid={TESTIDS.importSetButton}>
            Import
          </Link>
        </div>
      </header>

      {state.sets.length === 0 ? (
        <div>
          <p>You don&apos;t have any sets yet. Start from a test set, or create or import your own.</p>
          <ul className="starter-set-list">
            {STARTER_SETS.map((starter) => (
              <li key={starter.id}>
                <button type="button" data-testid={TESTIDS.setsStarterLoad} onClick={() => handleLoadStarter(starter)}>
                  Load: {starter.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div>
          <ul className="set-list" data-testid={TESTIDS.setsList}>
            {filteredSets.map((set) => (
              <SetListItem key={set.id} set={set} setCards={state.cards.filter((card) => card.setId === set.id)} />
            ))}
          </ul>
          {filteredSets.length === 0 && <p>No sets match &quot;{query}&quot;.</p>}
        </div>
      )}
    </section>
  )
}
