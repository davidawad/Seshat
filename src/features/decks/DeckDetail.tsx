import { useId, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSeshatStore } from '../../lib/store'
import { type Deck, deckIdSchema } from '../../types'
import { CardForm } from './CardForm'
import { CardListItem } from './CardListItem'
import { downloadJson, slugify } from './download'
import { toSimpleJson } from './simple-json'

const MS_PER_DAY = 24 * 60 * 60 * 1000

const daysUntil = (isoDate: string): number => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const goal = new Date(`${isoDate}T00:00:00`)
  return Math.round((goal.getTime() - today.getTime()) / MS_PER_DAY)
}

const GoalDateField = ({ deck }: { readonly deck: Deck }) => {
  const inputId = useId()
  const { updateDeck } = useSeshatStore()
  const days = deck.goalDate === null ? null : daysUntil(deck.goalDate)

  return (
    <div className="deck-goal-date">
      <label htmlFor={inputId}>Goal date (exam, review deadline)</label>
      <input
        id={inputId}
        type="date"
        value={deck.goalDate ?? ''}
        onChange={(event) =>
          updateDeck(deck.id, { goalDate: event.target.value.length > 0 ? event.target.value : null })
        }
      />
      {deck.goalDate !== null && (
        <p role="status">
          {days === null
            ? null
            : days > 0
              ? `${days} day${days === 1 ? '' : 's'} to go — scheduling is tightening as this approaches.`
              : days === 0
                ? 'Goal date is today.'
                : 'Goal date has passed — scheduling back to your normal retention target.'}
        </p>
      )}
      <p className="field-hint">
        Optional. When set, Seshat never schedules a card's next review past this date, and gradually raises the
        retention target as it nears — see <code>research/learning-science/cepeda-2008.md</code>.
      </p>
    </div>
  )
}

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

  const handleExportSimpleJson = () => {
    downloadJson(`${slugify(deck.name)}.json`, toSimpleJson(deck.name, cards))
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

      <nav aria-label="Study modes">
        <ul className="study-mode-list">
          <li>
            <Link to={`/?deck=${deckId}`}>Study (recommended)</Link> — recall-first, spaced by FSRS
          </li>
          <li>
            <Link to={`/flashcards/${deckId}`}>Flashcards</Link> — flip through the whole deck
          </li>
          <li>
            <Link to={`/test/${deckId}`}>Test</Link> — a generated practice test, scored at the end
          </li>
          <li>
            <Link to={`/match/${deckId}`}>Match</Link> — a timed matching drill
          </li>
        </ul>
      </nav>

      <GoalDateField deck={deck} />

      <button type="button" onClick={handleExport} disabled={cards.length === 0}>
        Export deck as JSON
      </button>
      <button type="button" onClick={handleExportSimpleJson} disabled={cards.length === 0}>
        Export as term/definition JSON
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
