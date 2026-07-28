import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSeshatStore } from '../../lib/store'
import { CreateSetForm } from './CreateSetForm'
import { setMatchesQuery } from './filters'
import { ImportButton } from './ImportPanel'
import { SAMPLE_SET } from './sample-set'
import './sets.css'
import { SetListItem } from './SetListItem'

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

  const handleLoadSample = () => {
    const set = importSet(SAMPLE_SET)
    navigate(`/sets/${set.id}`)
  }

  return (
    <section aria-labelledby="sets-heading">
      <header className="sets-header">
        <h1 id="sets-heading">Sets</h1>
        <ImportButton />
      </header>

      {state.sets.length === 0 ? (
        <div>
          <p>You don&apos;t have any sets yet.</p>
          <button type="button" onClick={handleLoadSample}>
            Load sample set: &quot;How Spaced Repetition Actually Works&quot;
          </button>
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

          <ul>
            {filteredSets.map((set) => (
              <SetListItem key={set.id} set={set} setCards={state.cards.filter((card) => card.setId === set.id)} />
            ))}
          </ul>
          {filteredSets.length === 0 && <p>No sets match &quot;{query}&quot;.</p>}
        </div>
      )}

      <CreateSetForm onCreated={(setId) => navigate(`/sets/${setId}`)} />
    </section>
  )
}
