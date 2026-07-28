import { Link, useParams } from 'react-router-dom'
import { MatchSession } from '../features/match/MatchSession'
import type { MatchPair } from '../features/match/round'
import { cardFrontBack } from '../features/study/card-summary'
import { useSeshatStore } from '../lib/store'
import { setIdSchema } from '../types'

/** Matching needs at least two pairs to be a game at all. */
const MIN_PAIRS = 2

export const MatchPage = () => {
  const { id } = useParams<{ id: string }>()
  const { state } = useSeshatStore()

  const parsedId = setIdSchema.safeParse(id ?? '')

  if (!parsedId.success) {
    return (
      <section aria-labelledby="match-heading">
        <h1 id="match-heading">Set not found</h1>
        <p>
          <Link to="/sets">Back to sets</Link>
        </p>
      </section>
    )
  }

  const setId = parsedId.data
  const set = state.sets.find((candidate) => candidate.id === setId)

  if (set === undefined) {
    return (
      <section aria-labelledby="match-heading">
        <h1 id="match-heading">Set not found</h1>
        <p>This set may have been deleted.</p>
        <p>
          <Link to="/sets">Back to sets</Link>
        </p>
      </section>
    )
  }

  const pairs: MatchPair[] = state.cards
    .filter((card) => card.setId === setId)
    .map((card) => {
      const { front, back } = cardFrontBack(card)
      return { cardId: card.id, front, back }
    })

  if (pairs.length < MIN_PAIRS) {
    return (
      <section aria-labelledby="match-heading">
        <p>
          <Link to={`/sets/${setId}`}>Back to {set.name}</Link>
        </p>
        <h1 id="match-heading">Match: {set.name}</h1>
        <p>
          Match needs at least {MIN_PAIRS} cards to build a round — this set has {pairs.length}. Add a few more cards to
          this set, then come back.
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="match-heading">
      <p>
        <Link to={`/sets/${setId}`}>Back to {set.name}</Link>
      </p>
      <h1 id="match-heading">Match: {set.name}</h1>
      <p>Pick a term and its matching definition. Timing starts on your first pick — no penalty for a miss.</p>
      <MatchSession key={setId} setId={setId} pairs={pairs} />
    </section>
  )
}
