import { useId, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSeshatStore } from '../../lib/store'
import { type StudySet, setIdSchema } from '../../types'
import { CardForm } from './CardForm'
import { CardListItem } from './CardListItem'
import { parseTagsInput } from './tags'

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

/** Name, description, and tags — the set's own identity, saved on blur. */
const SetDetailsFields = ({ set }: { readonly set: StudySet }) => {
  const { updateSet } = useSeshatStore()
  const [name, setName] = useState(set.name)
  const [description, setDescription] = useState(set.description)
  const [tagsText, setTagsText] = useState(set.tags.join(', '))
  const [nameError, setNameError] = useState<string | null>(null)

  const nameId = useId()
  const descriptionId = useId()
  const tagsId = useId()
  const errorId = useId()

  const saveName = () => {
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      setNameError('Set name is required.')
      setName(set.name)
      return
    }
    setNameError(null)
    if (trimmed !== set.name) updateSet(set.id, { name: trimmed })
  }

  return (
    <div className="set-details-fields">
      <div>
        <label htmlFor={nameId}>Name</label>
        <input
          id={nameId}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={saveName}
          aria-invalid={nameError !== null}
          aria-describedby={nameError !== null ? errorId : undefined}
          required
        />
        {nameError !== null && (
          <p id={errorId} role="alert">
            {nameError}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={descriptionId}>Description</label>
        <textarea
          id={descriptionId}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={() => updateSet(set.id, { description: description.trim() })}
          rows={2}
        />
      </div>
      <div>
        <label htmlFor={tagsId}>Tags (comma-separated)</label>
        <input
          id={tagsId}
          type="text"
          value={tagsText}
          onChange={(event) => setTagsText(event.target.value)}
          onBlur={() => updateSet(set.id, { tags: parseTagsInput(tagsText) })}
        />
      </div>
    </div>
  )
}

/** Name/description/tags, goal date, and card CRUD — the one place a set gets edited, kept off the hub page. */
export const SetEditPage = () => {
  const { id } = useParams<{ id: string }>()
  const { state, deleteSet } = useSeshatStore()
  const navigate = useNavigate()
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

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Delete "${set.name}"? This permanently removes its ${cards.length} card(s) and all review history. This cannot be undone.`,
    )
    if (!confirmed) return
    deleteSet(setId)
    navigate('/sets')
  }

  return (
    <section aria-labelledby="set-edit-heading">
      <p>
        <Link to={`/sets/${setId}`}>Back to {set.name}</Link>
      </p>
      <h1 id="set-edit-heading">Edit set</h1>

      <SetDetailsFields set={set} />
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

      <p className="set-danger-zone">
        <button type="button" onClick={handleDelete}>
          Delete this set
        </button>
      </p>
    </section>
  )
}
