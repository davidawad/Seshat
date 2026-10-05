import { Link, useParams } from 'react-router-dom'
import { LearnSession } from '../features/learn/LearnSession'
import { imageCardCount, imageCardsNote, textCards } from '../features/study/text-cards'
import { useSeshatStore } from '../lib/store'
import { TESTIDS } from '../lib/testids'
import { setIdSchema } from '../types'

const NotFound = ({ message }: { readonly message: string }) => (
  <section aria-labelledby="learn-heading">
    <h1 id="learn-heading">Learn</h1>
    <p>{message}</p>
    <p>
      <Link to="/sets">Back to sets</Link>
    </p>
  </section>
)

const DOI = 'https://doi.org/'

/** The evidence behind the format, with real references (also listed on Attributions and in research/). */
const Research = () => (
  <details className="learn-research" data-testid={TESTIDS.learnResearch}>
    <summary>Why Learn works this way</summary>
    <p>
      Pulling an answer out of memory beats re-reading it, and typing it from memory beats recognising it among options
      (Rowland, 2014,{' '}
      <a href={`${DOI}10.1037/a0037559`} target="_blank" rel="noopener noreferrer">
        Psychological Bulletin 140(6), 1432-1463
      </a>
      ). So each term starts as multiple choice and moves on to typing once you get it right, and a miss sends it back a
      step and brings it up again soon, with the correct answer shown.
    </p>
    <p>
      Getting a term right more than once in a session, and then coming back to it in later sessions (successive
      relearning), improves long-term retention (Rawson &amp; Dunlosky, 2011,{' '}
      <a href={`${DOI}10.1037/a0023956`} target="_blank" rel="noopener noreferrer">
        Journal of Experimental Psychology: General 140(3), 283-302
      </a>
      ). Your typed answers go into the same FSRS schedule and review history as Study, so the next review is set by
      FSRS, not by this session.
    </p>
  </details>
)

/** `/sets/:id/learn`: a Learn-style adaptive mode (rounds, multiple choice then typed) on top of the FSRS schedule. */
export const LearnPage = () => {
  const { id } = useParams<{ id: string }>()
  const { state } = useSeshatStore()

  const parsedId = setIdSchema.safeParse(id ?? '')
  if (!parsedId.success) return <NotFound message="This link doesn't point to a valid set." />

  const setId = parsedId.data
  const set = state.sets.find((candidate) => candidate.id === setId)
  if (set === undefined) return <NotFound message="This set may have been deleted." />

  const setCards = state.cards.filter((candidate) => candidate.setId === setId)
  // Image-occlusion cards cannot be asked as text questions; they stay in Study and Flashcards.
  const cards = textCards(setCards)
  const note = imageCardsNote(imageCardCount(setCards))

  return (
    <section aria-labelledby="learn-heading" data-testid={TESTIDS.learnPage}>
      <p>
        <Link to={`/sets/${setId}`}>Back to {set.name}</Link>
      </p>
      <h1 id="learn-heading">Learn: {set.name}</h1>
      {note !== null && <p>{note}</p>}
      {setCards.length === 0 ? (
        <p data-testid={TESTIDS.learnEmpty}>This set has no cards yet. Add some from the set page first.</p>
      ) : cards.length === 0 ? (
        <p data-testid={TESTIDS.learnNoTextCards}>
          Learn needs text cards, and every card in this set is an image card. Use Study or Flashcards instead.
        </p>
      ) : (
        <>
          <p className="learn-intro">
            Short rounds: multiple choice first, then type it from memory. Misses come back soon.
          </p>
          <LearnSession setId={setId} cards={cards} />
          <Research />
        </>
      )}
    </section>
  )
}
