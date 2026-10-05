import { Link, useParams } from 'react-router-dom'
import { imageCardCount, imageCardsNote, textCards } from '../features/study/text-cards'
import { TestSession } from '../features/test-mode/TestSession'
import { useSeshatStore } from '../lib/store'
import { TESTIDS } from '../lib/testids'
import { setIdSchema } from '../types'

const NotFound = ({ message }: { readonly message: string }) => (
  <section aria-labelledby="test-heading">
    <h1 id="test-heading">Test</h1>
    <p>{message}</p>
    <p>
      <Link to="/sets">Back to sets</Link>
    </p>
  </section>
)

export const TestPage = () => {
  const { id } = useParams<{ id: string }>()
  const { state } = useSeshatStore()

  const parsedId = setIdSchema.safeParse(id ?? '')
  if (!parsedId.success) return <NotFound message="This link doesn't point to a valid set." />

  const setId = parsedId.data
  const set = state.sets.find((candidate) => candidate.id === setId)
  if (set === undefined) return <NotFound message="This set may have been deleted." />

  const setCards = state.cards.filter((candidate) => candidate.setId === setId)
  // Image-occlusion cards cannot be asked as text questions; they stay in Study/Flashcards.
  const cards = textCards(setCards)
  const note = imageCardsNote(imageCardCount(setCards))

  return (
    <section aria-labelledby="test-heading" data-testid={TESTIDS.testPage}>
      <p>
        <Link to={`/sets/${setId}`}>Back to {set.name}</Link>
      </p>
      <h1 id="test-heading">Test: {set.name}</h1>
      {note !== null && <p data-testid={TESTIDS.testImageNote}>{note}</p>}
      {setCards.length === 0 ? (
        <p>This set has no cards yet. Add some from the set page first.</p>
      ) : cards.length === 0 ? (
        <p data-testid={TESTIDS.testNoTextCards}>
          Test mode needs text cards, and every card in this set is an image card. Use Study or Flashcards instead.
        </p>
      ) : (
        <TestSession key={setId} cards={cards} />
      )}
    </section>
  )
}
