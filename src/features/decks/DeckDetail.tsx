import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSeshatStore } from '../../lib/store'
import { deckIdSchema } from '../../types'
import { CardForm } from './CardForm'
import { CardListItem } from './CardListItem'
import { downloadJson, slugify } from './download'

export const DeckDetailPage = () => {
  const { deckId: deckIdParam } = useParams<{ deckId: string }>()
  const { state, exportDeck } = useSeshatStore()
  const [isAdding, setIsAdding] = useState(false)

  const parsedDeckId = deckIdSchema.safeParse(deckIdParam ?? '')

  if (!parsedDeckId.success) {
    return (
      <section aria-labelledby="deck-not-found-heading">
        <h1 id="deck-not-found-heading">Deck not found</h1>
        <p>
          <Link to="/decks">Back to decks</Link>
        </p>
      </section>
    )
  }

  const deckId = parsedDeckId.data
  const deck = state.decks.find((candidate) => candidate.id === deckId)

  if (deck === undefined) {
    return (
      <section aria-labelledby="deck-not-found-heading">
        <h1 id="deck-not-found-heading">Deck not found</h1>
        <p>This deck may have been deleted.</p>
        <p>
          <Link to="/decks">Back to decks</Link>
        </p>
      </section>
    )
  }

  const cards = state.cards.filter((card) => card.deckId === deckId)

  const handleExport = () => {
    const exported = exportDeck(deckId)
    if (exported === null) return
    downloadJson(`${slugify(deck.name)}.seshat.json`, exported)
  }

  return (
    <section aria-labelledby="deck-detail-heading">
      <p>
        <Link to="/decks">Back to decks</Link>
      </p>
      <h1 id="deck-detail-heading">{deck.name}</h1>
      {deck.description.length > 0 && <p>{deck.description}</p>}
      {deck.tags.length > 0 && (
        <ul aria-label="Tags">
          {deck.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}

      <p>
        <Link to={`/?deck=${deckId}`}>Study this deck</Link>
      </p>

      <button type="button" onClick={handleExport} disabled={cards.length === 0}>
        Export deck as JSON
      </button>

      <h2>Cards ({cards.length})</h2>
      {cards.length === 0 && <p>No cards yet. Add the first one below.</p>}
      <ul>
        {cards.map((card) => (
          <CardListItem key={card.id} card={card} />
        ))}
      </ul>

      {isAdding ? (
        <CardForm deckId={deckId} editingCard={null} onDone={() => setIsAdding(false)} />
      ) : (
        <button type="button" onClick={() => setIsAdding(true)}>
          Add card
        </button>
      )}
    </section>
  )
}
