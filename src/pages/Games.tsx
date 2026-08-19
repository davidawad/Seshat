import { Link, useParams } from 'react-router-dom'
import { GAMES } from '../features/games/registry'
import { useSeshatStore } from '../lib/store'
import { setIdSchema } from '../types'
import '../features/sets/sets.css'

const NotFound = ({ message }: { readonly message: string }) => (
  <section aria-labelledby="games-heading">
    <h1 id="games-heading">Games</h1>
    <p>{message}</p>
    <p>
      <Link to="/sets">Back to sets</Link>
    </p>
  </section>
)

/** Shared by both pages below: resolves `:id` to a set + its cards, or `null` if either check fails. */
const useSetContext = () => {
  const { id } = useParams<{ id: string }>()
  const { state } = useSeshatStore()

  const parsedId = setIdSchema.safeParse(id ?? '')
  if (!parsedId.success) return null

  const setId = parsedId.data
  const set = state.sets.find((candidate) => candidate.id === setId)
  if (set === undefined) return null

  const cards = state.cards.filter((card) => card.setId === setId)
  return { setId, set, cards }
}

/** `/sets/:id/games` — picks among GAMES, disabling ones the set doesn't have enough cards for yet. */
export const GamesListPage = () => {
  const context = useSetContext()
  if (context === null) return <NotFound message="This set may have been deleted." />
  const { setId, set, cards } = context

  return (
    <section aria-labelledby="games-heading">
      <p>
        <Link to={`/sets/${setId}`}>Back to {set.name}</Link>
      </p>
      <h1 id="games-heading">Games: {set.name}</h1>
      <p>Ungraded, arcade-style practice — these don't feed your Study schedule.</p>
      <nav aria-label="Games" className="mode-grid">
        {GAMES.map((game) => {
          const playable = cards.length >= game.minCards
          return playable ? (
            <Link key={game.id} to={`/sets/${setId}/games/${game.id}`} className="mode-button">
              <span className="mode-button-label">{game.label}</span>
              <span className="mode-button-hint">{game.description}</span>
            </Link>
          ) : (
            <div key={game.id} className="mode-button is-disabled" aria-disabled="true">
              <span className="mode-button-label">{game.label}</span>
              <span className="mode-button-hint">
                Needs at least {game.minCards} card{game.minCards === 1 ? '' : 's'} — this set has {cards.length}.
              </span>
            </div>
          )
        })}
      </nav>
    </section>
  )
}

/** `/sets/:id/games/:gameId` — mounts one game's session component. */
export const GameSessionPage = () => {
  const { gameId } = useParams<{ gameId: string }>()
  const context = useSetContext()
  if (context === null) return <NotFound message="This set may have been deleted." />
  const { setId, set, cards } = context

  const game = GAMES.find((candidate) => candidate.id === gameId)
  if (game === undefined) return <NotFound message="This game doesn't exist." />

  return (
    <section aria-labelledby="games-heading">
      <p>
        <Link to={`/sets/${setId}/games`}>Back to games</Link>
      </p>
      <h1 id="games-heading">
        {game.label}: {set.name}
      </h1>
      {cards.length < game.minCards ? (
        <p>
          {game.label} needs at least {game.minCards} card{game.minCards === 1 ? '' : 's'} to build a round — this set
          has {cards.length}. Add a few more cards to this set, then come back.
        </p>
      ) : (
        <game.Component key={setId} setId={setId} setName={set.name} cards={cards} />
      )}
    </section>
  )
}
