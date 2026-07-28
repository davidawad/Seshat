import { type FormEvent, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSeshatStore } from '../../lib/store'
import { isDue } from '../../lib/fsrs'
import type { StudyCard, StudySet } from '../../types'
import { parseTagsInput } from './tags'

interface SetListItemProps {
  readonly set: StudySet
  readonly setCards: readonly StudyCard[]
}

export const SetListItem = ({ set, setCards }: SetListItemProps) => {
  const { updateSet, deleteSet } = useSeshatStore()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(set.name)
  const [description, setDescription] = useState(set.description)
  const [tagsText, setTagsText] = useState(set.tags.join(', '))
  const [error, setError] = useState<string | null>(null)

  const nameId = useId()
  const descriptionId = useId()
  const tagsId = useId()
  const errorId = useId()

  const now = new Date()
  const dueCount = setCards.filter((card) => isDue(card.scheduling, now)).length

  const startEditing = () => {
    setName(set.name)
    setDescription(set.description)
    setTagsText(set.tags.join(', '))
    setError(null)
    setIsEditing(true)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      setError('Set name is required.')
      return
    }
    updateSet(set.id, { name: trimmedName, description: description.trim(), tags: parseTagsInput(tagsText) })
    setIsEditing(false)
  }

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Delete "${set.name}"? This permanently removes its ${setCards.length} card(s) and all review history. This cannot be undone.`,
    )
    if (!confirmed) return
    deleteSet(set.id)
  }

  if (isEditing) {
    return (
      <li>
        <form onSubmit={handleSubmit} aria-label={`Rename ${set.name}`}>
          <div>
            <label htmlFor={nameId}>Name</label>
            <input
              id={nameId}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={error !== null}
              aria-describedby={error !== null ? errorId : undefined}
              required
            />
          </div>
          <div>
            <label htmlFor={descriptionId}>Description</label>
            <textarea
              id={descriptionId}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
            />
          </div>
          <div>
            <label htmlFor={tagsId}>Tags (comma-separated)</label>
            <input id={tagsId} type="text" value={tagsText} onChange={(event) => setTagsText(event.target.value)} />
          </div>
          {error !== null && (
            <p id={errorId} role="alert">
              {error}
            </p>
          )}
          <button type="submit">Save</button>
          <button type="button" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
        </form>
      </li>
    )
  }

  return (
    <li>
      <h2>
        <Link to={`/sets/${set.id}`}>{set.name}</Link>
      </h2>
      {set.description.length > 0 && <p>{set.description}</p>}
      {set.tags.length > 0 && (
        <ul aria-label="Tags">
          {set.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
      <p>
        {setCards.length} card(s) · {dueCount} due now
      </p>
      <button type="button" onClick={startEditing}>
        Rename
      </button>
      <button type="button" onClick={handleDelete}>
        Delete
      </button>
    </li>
  )
}
