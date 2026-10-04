import { Link, useNavigate } from 'react-router-dom'
import { SetProgressCard } from '../features/sets/SetProgressCard'
import { type StarterSet, STARTER_SETS } from '../features/sets/starter-sets'
import { summarizeMastery } from '../features/sets/set-summary'
import { useSeshatStore } from '../lib/store'
import './home.css'

/** Landing page: your sets as cards with memorized/total progress, so you can open the page and jump straight into studying. */
export const HomePage = () => {
  const { state, importSet } = useSeshatStore()
  const navigate = useNavigate()
  const now = new Date()

  const handleLoadStarter = (starter: StarterSet) => {
    const set = importSet(starter.set)
    navigate(`/sets/${set.id}`)
  }

  return (
    <section aria-labelledby="home-heading">
      <h1 id="home-heading">Your sets</h1>

      {state.sets.length === 0 ? (
        <div>
          <p>You don&apos;t have any sets yet. Start from a test set, or create your own on the Sets page.</p>
          <ul className="starter-set-list">
            {STARTER_SETS.map((starter) => (
              <li key={starter.id}>
                <button type="button" onClick={() => handleLoadStarter(starter)}>
                  Load: {starter.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="home-set-grid">
          {state.sets.map((set) => {
            const mastery = summarizeMastery(
              state.cards.filter((card) => card.setId === set.id),
              now,
            )
            return (
              <li key={set.id}>
                <SetProgressCard set={set} mastery={mastery} />
              </li>
            )
          })}
        </ul>
      )}

      <p className="home-manage-sets">
        <Link to="/sets">Manage sets</Link>
      </p>
    </section>
  )
}
