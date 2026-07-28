import { useId, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useSeshatStore } from '../../lib/store'
import { type StudySet, setIdSchema } from '../../types'
import { CardForm } from './CardForm'
import { CardListItem } from './CardListItem'

const MS_PER_DAY = 24 * 60 * 60 * 1000

const daysUntil = (isoDate: string): number => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const goal = new Date(`${isoDate}T00:00:00`)
  return Math.round((goal.getTime() - today.getTime()) / MS_PER_DAY)
}

const GoalDateField = ({ set }: { readonly set: StudySet }) => {
  const inputId = useId()
  const { updateSet } = useSeshatStore()
  const days = set.goalDate === null ? null : daysUntil(set.goalDate)

  return (
    <div className="set-goal-date">
      <label htmlFor={inputId}>Goal date (exam, review deadline)</label>
      <input
        id={inputId}
        type="date"
        value={set.goalDate ?? ''}
        onChange={(event) => updateSet(set.id, { goalDate: event.target.value.length > 0 ? event.target.value : null })}
      />
      {set.goalDate !== null && (
        <p role="status">
          {days === null
            ? null
            : days > 0
              ? `${days} day${days === 1 ? '' : 's'} to go — scheduling is tightening as this approaches.`
              : days === 0
                ? 'Goal date is today.'
                : 'Goal date has passed — scheduling back to your normal retention target.'}
        </p>
      )}
      <p className="field-hint">
        Optional. When set, Seshat never schedules a card's next review past this date, and gradually raises the
        retention target as it nears — see <code>research/learning-science/cepeda-2008.md</code>.
      </p>
    </div>
  )
}

/** Card CRUD + goal date — everything about curating a set's material, kept off the hub page. */
export const SetEditPage = () => {
  const { id } = useParams<{ id: string }>()
  const { state } = useSeshatStore()
  const [isAdding, setIsAdding] = useState(false)

  const parsedId = setIdSchema.safeParse(id ?? '')

  if (!parsedId.success) {
    return (
      <section aria-labelledby="set-not-found-heading">
        <h1 id="set-not-found-heading">Set not found</h1>
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
      <section aria-labelledby="set-not-found-heading">
        <h1 id="set-not-found-heading">Set not found</h1>
        <p>This set may have been deleted.</p>
        <p>
          <Link to="/sets">Back to sets</Link>
        </p>
      </section>
    )
  }

  const cards = state.cards.filter((card) => card.setId === setId)

  return (
    <section aria-labelledby="set-edit-heading">
      <p>
        <Link to={`/sets/${setId}`}>Back to {set.name}</Link>
      </p>
      <h1 id="set-edit-heading">Edit: {set.name}</h1>

      <GoalDateField set={set} />

      <h2>Cards ({cards.length})</h2>
      {cards.length === 0 && <p>No cards yet. Add the first one below.</p>}
      <ul>
        {cards.map((card) => (
          <CardListItem key={card.id} card={card} />
        ))}
      </ul>

      {isAdding ? (
        <CardForm setId={setId} editingCard={null} onDone={() => setIsAdding(false)} />
      ) : (
        <button type="button" onClick={() => setIsAdding(true)}>
          Add card
        </button>
      )}
    </section>
  )
}
