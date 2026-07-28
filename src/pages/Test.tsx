import { Link, useParams } from 'react-router-dom'
import { TestSession } from '../features/test-mode/TestSession'
import { useSeshatStore } from '../lib/store'
import { deckIdSchema } from '../types'

const NotFound = ({ message }: { readonly message: string }) => (
  <section aria-labelledby="test-heading">
    <h1 id="test-heading">Test</h1>
    <p>{message}</p>
    <p>
      <Link to="/decks">Back to decks</Link>
    </p>
  </section>
)

export const TestPage = () => {
  const { deckId: deckIdParam } = useParams<{ deckId: string }>()
  const { state } = useSeshatStore()

  const parsedDeckId = deckIdSchema.safeParse(deckIdParam ?? '')
  if (!parsedDeckId.success) return <NotFound message="This link doesn't point to a valid deck." />

  const deckId = parsedDeckId.data
  const deck = state.decks.find((candidate) => candidate.id === deckId)
  if (deck === undefined) return <NotFound message="This deck may have been deleted." />

  const cards = state.cards.filter((candidate) => candidate.deckId === deckId)

  return (
    <section aria-labelledby="test-heading">
      <p>
        <Link to={`/decks/${deckId}`}>Back to {deck.name}</Link>
      </p>
      <h1 id="test-heading">Test: {deck.name}</h1>
      {cards.length === 0 ? (
        <p>This deck has no cards yet. Add some from the deck page first.</p>
      ) : (
        <TestSession key={deckId} cards={cards} />
      )}
    </section>
  )
}
