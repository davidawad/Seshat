import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FlashcardSession } from '../features/flashcards/FlashcardSession'
import {
  type FlashcardSessionState,
  advanceSession,
  createFlashcardSession,
  currentCardId,
  isSessionComplete,
} from '../features/flashcards/session'
import { useSeshatStore } from '../lib/store'
import { type CardId, type DeckId, deckIdSchema } from '../types'

const NotFound = ({ message }: { readonly message: string }) => (
  <section aria-labelledby="flashcards-heading">
    <h1 id="flashcards-heading">Flashcards</h1>
    <p>{message}</p>
    <p>
      <Link to="/decks">Back to decks</Link>
    </p>
  </section>
)

interface FlashcardRunnerProps {
  readonly deckId: DeckId
  readonly deckName: string
  readonly cardIds: readonly CardId[]
}

/**
 * Owns the session's shuffled order, position, and known tally. The order
 * is fixed once at mount (via the lazy `useState` initializer) so recording
 * a review — which updates that card's FSRS scheduling in the store — never
 * reshuffles or resizes the running session.
 */
const FlashcardRunner = ({ deckId, deckName, cardIds }: FlashcardRunnerProps) => {
  const { state } = useSeshatStore()
  const [session, setSession] = useState<FlashcardSessionState>(() => createFlashcardSession(cardIds))

  const handleAdvance = (known: boolean) => setSession((previous) => advanceSession(previous, known))

  const currentId = currentCardId(session)
  const card = currentId === null ? undefined : state.cards.find((candidate) => candidate.id === currentId)
  const complete = isSessionComplete(session) || card === undefined

  return (
    <section aria-labelledby="flashcards-heading">
      <p>
        <Link to={`/decks/${deckId}`}>Back to {deckName}</Link>
      </p>
      <h1 id="flashcards-heading">Flashcards: {deckName}</h1>

      {complete ? (
        <p role="status">
          Session complete — {session.order.length} card{session.order.length === 1 ? '' : 's'}, {session.knownCount}{' '}
          marked known.
        </p>
      ) : (
        card !== undefined && (
          <FlashcardSession
            card={card}
            position={session.position}
            total={session.order.length}
            onAdvance={handleAdvance}
          />
        )
      )}
    </section>
  )
}

export const FlashcardsPage = () => {
  const { deckId: deckIdParam } = useParams<{ deckId: string }>()
  const { state } = useSeshatStore()

  const parsedDeckId = deckIdSchema.safeParse(deckIdParam ?? '')
  if (!parsedDeckId.success) return <NotFound message="This link doesn't point to a valid deck." />

  const deckId = parsedDeckId.data
  const deck = state.decks.find((candidate) => candidate.id === deckId)
  if (deck === undefined) return <NotFound message="This deck may have been deleted." />

  const cards = state.cards.filter((candidate) => candidate.deckId === deckId)
  if (cards.length === 0) {
    return (
      <section aria-labelledby="flashcards-heading">
        <p>
          <Link to={`/decks/${deckId}`}>Back to {deck.name}</Link>
        </p>
        <h1 id="flashcards-heading">Flashcards: {deck.name}</h1>
        <p>This deck has no cards yet. Add some from the deck page first.</p>
      </section>
    )
  }

  return <FlashcardRunner key={deckId} deckId={deckId} deckName={deck.name} cardIds={cards.map((card) => card.id)} />
}
