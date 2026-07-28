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
import { type CardId, type SetId, setIdSchema } from '../types'

const NotFound = ({ message }: { readonly message: string }) => (
  <section aria-labelledby="flashcards-heading">
    <h1 id="flashcards-heading">Flashcards</h1>
    <p>{message}</p>
    <p>
      <Link to="/sets">Back to sets</Link>
    </p>
  </section>
)

interface FlashcardRunnerProps {
  readonly setId: SetId
  readonly setName: string
  readonly cardIds: readonly CardId[]
}

/**
 * Owns the session's shuffled order, position, and known tally. The order
 * is fixed once at mount (via the lazy `useState` initializer) so recording
 * a review — which updates that card's FSRS scheduling in the store — never
 * reshuffles or resizes the running session.
 */
const FlashcardRunner = ({ setId, setName, cardIds }: FlashcardRunnerProps) => {
  const { state } = useSeshatStore()
  const [session, setSession] = useState<FlashcardSessionState>(() => createFlashcardSession(cardIds))

  const handleAdvance = (known: boolean) => setSession((previous) => advanceSession(previous, known))

  const currentId = currentCardId(session)
  const card = currentId === null ? undefined : state.cards.find((candidate) => candidate.id === currentId)
  const complete = isSessionComplete(session) || card === undefined

  return (
    <section aria-labelledby="flashcards-heading">
      <p>
        <Link to={`/sets/${setId}`}>Back to {setName}</Link>
      </p>
      <h1 id="flashcards-heading">Flashcards: {setName}</h1>

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
  const { id } = useParams<{ id: string }>()
  const { state } = useSeshatStore()

  const parsedId = setIdSchema.safeParse(id ?? '')
  if (!parsedId.success) return <NotFound message="This link doesn't point to a valid set." />

  const setId = parsedId.data
  const set = state.sets.find((candidate) => candidate.id === setId)
  if (set === undefined) return <NotFound message="This set may have been deleted." />

  const cards = state.cards.filter((candidate) => candidate.setId === setId)
  if (cards.length === 0) {
    return (
      <section aria-labelledby="flashcards-heading">
        <p>
          <Link to={`/sets/${setId}`}>Back to {set.name}</Link>
        </p>
        <h1 id="flashcards-heading">Flashcards: {set.name}</h1>
        <p>This set has no cards yet. Add some from the set page first.</p>
      </section>
    )
  }

  return <FlashcardRunner key={setId} setId={setId} setName={set.name} cardIds={cards.map((card) => card.id)} />
}
