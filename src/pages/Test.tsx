import { Link, useParams } from 'react-router-dom'
import { TestSession } from '../features/test-mode/TestSession'
import { useSeshatStore } from '../lib/store'
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

  const cards = state.cards.filter((candidate) => candidate.setId === setId)

  return (
    <section aria-labelledby="test-heading">
      <p>
        <Link to={`/sets/${setId}`}>Back to {set.name}</Link>
      </p>
      <h1 id="test-heading">Test: {set.name}</h1>
      {cards.length === 0 ? (
        <p>This set has no cards yet. Add some from the set page first.</p>
      ) : (
        <TestSession key={setId} cards={cards} />
      )}
    </section>
  )
}
