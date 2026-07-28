import { Link, useParams } from 'react-router-dom'
import { MatchSession } from '../features/match/MatchSession'
import type { MatchPair } from '../features/match/round'
import { cardFrontBack } from '../features/study/card-summary'
import { useSeshatStore } from '../lib/store'
import { deckIdSchema } from '../types'

/** Matching needs at least two pairs to be a game at all. */
const MIN_PAIRS = 2

export const MatchPage = () => {
  const { deckId: deckIdParam } = useParams<{ deckId: string }>()
  const { state } = useSeshatStore()

  const parsedDeckId = deckIdSchema.safeParse(deckIdParam ?? '')

  if (!parsedDeckId.success) {
    return (
      <section aria-labelledby="match-heading">
        <h1 id="match-heading">Deck not found</h1>
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
      <section aria-labelledby="match-heading">
        <h1 id="match-heading">Deck not found</h1>
        <p>This deck may have been deleted.</p>
        <p>
          <Link to="/decks">Back to decks</Link>
        </p>
      </section>
    )
  }

  const pairs: MatchPair[] = state.cards
    .filter((card) => card.deckId === deckId)
    .map((card) => {
      const { front, back } = cardFrontBack(card)
      return { cardId: card.id, front, back }
    })

  if (pairs.length < MIN_PAIRS) {
    return (
      <section aria-labelledby="match-heading">
        <p>
          <Link to={`/decks/${deckId}`}>Back to {deck.name}</Link>
        </p>
        <h1 id="match-heading">Match: {deck.name}</h1>
        <p>
          Match needs at least {MIN_PAIRS} cards to build a round — this deck has {pairs.length}. Add a few more cards
          to this deck, then come back.
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="match-heading">
      <p>
        <Link to={`/decks/${deckId}`}>Back to {deck.name}</Link>
      </p>
      <h1 id="match-heading">Match: {deck.name}</h1>
      <p>Pick a term and its matching definition. Timing starts on your first pick — no penalty for a miss.</p>
      <MatchSession key={deckId} deckId={deckId} pairs={pairs} />
    </section>
  )
}
