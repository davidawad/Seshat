import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSeshatStore } from '../../lib/store'
import { CreateDeckForm } from './CreateDeckForm'
import { DeckListItem } from './DeckListItem'
import { deckMatchesQuery } from './filters'
import { ImportPanel } from './ImportPanel'
import { SAMPLE_DECK } from './sample-deck'

export const DeckListPage = () => {
  const { state, importDeck } = useSeshatStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const searchId = useId()

  const filteredDecks = state.decks.filter((deck) =>
    deckMatchesQuery(
      deck,
      state.cards.filter((card) => card.deckId === deck.id),
      query,
    ),
  )

  const handleLoadSample = () => {
    const deck = importDeck(SAMPLE_DECK)
    navigate(`/decks/${deck.id}`)
  }

  return (
    <section aria-labelledby="decks-heading">
      <h1 id="decks-heading">Decks</h1>

      {state.decks.length === 0 ? (
        <div>
          <p>You don&apos;t have any decks yet.</p>
          <button type="button" onClick={handleLoadSample}>
            Load sample deck: &quot;How Spaced Repetition Actually Works&quot;
          </button>
        </div>
      ) : (
        <div>
          <label htmlFor={searchId}>Search decks</label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, tag, or card content"
          />

          <ul>
            {filteredDecks.map((deck) => (
              <DeckListItem
                key={deck.id}
                deck={deck}
                deckCards={state.cards.filter((card) => card.deckId === deck.id)}
              />
            ))}
          </ul>
          {filteredDecks.length === 0 && <p>No decks match &quot;{query}&quot;.</p>}
        </div>
      )}

      <CreateDeckForm onCreated={(deckId) => navigate(`/decks/${deckId}`)} />
      <ImportPanel />
    </section>
  )
}
