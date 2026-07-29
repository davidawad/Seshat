import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSeshatStore } from '../../lib/store'
import { CreateSetForm } from './CreateSetForm'
import { setMatchesQuery } from './filters'
import { ImportButton } from './ImportPanel'
import './sets.css'
import { SetListItem } from './SetListItem'
import { type StarterSet, STARTER_SETS } from './starter-sets'

export const SetListPage = () => {
  const { state, importSet } = useSeshatStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const searchId = useId()

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
    <section aria-labelledby="sets-heading">
      <header className="sets-header">
        <h1 id="sets-heading">Sets</h1>
        <div className="sets-header-actions">
          <CreateSetForm />
          <ImportButton />
        </div>
      </header>

      {state.sets.length === 0 ? (
        <div>
          <p>You don&apos;t have any sets yet. Start from a test set, or create your own above.</p>
          <ul className="starter-set-list">
            {STARTER_SETS.map((starter) => (
              <li key={starter.id}>
                <button type="button" onClick={() => handleLoadStarter(starter)}>
                  Load: {starter.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div>
          <label htmlFor={searchId}>Search sets</label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, tag, or card content"
          />

          <ul className="set-list">
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
