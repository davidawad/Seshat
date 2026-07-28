import { type FormEvent, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSeshatStore } from '../../lib/store'
import { isDue } from '../../lib/fsrs'
import type { Deck, StudyCard } from '../../types'
import { parseTagsInput } from './tags'

interface DeckListItemProps {
  readonly deck: Deck
  readonly deckCards: readonly StudyCard[]
}

export const DeckListItem = ({ deck, deckCards }: DeckListItemProps) => {
  const { updateDeck, deleteDeck } = useSeshatStore()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(deck.name)
  const [description, setDescription] = useState(deck.description)
  const [tagsText, setTagsText] = useState(deck.tags.join(', '))
  const [error, setError] = useState<string | null>(null)

  const nameId = useId()
  const descriptionId = useId()
  const tagsId = useId()
  const errorId = useId()

  const now = new Date()
  const dueCount = deckCards.filter((card) => isDue(card.scheduling, now)).length

  const startEditing = () => {
    setName(deck.name)
    setDescription(deck.description)
    setTagsText(deck.tags.join(', '))
    setError(null)
    setIsEditing(true)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      setError('Deck name is required.')
      return
    }
    updateDeck(deck.id, { name: trimmedName, description: description.trim(), tags: parseTagsInput(tagsText) })
    setIsEditing(false)
  }

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Delete "${deck.name}"? This permanently removes its ${deckCards.length} card(s) and all review history. This cannot be undone.`,
    )
    if (!confirmed) return
    deleteDeck(deck.id)
  }

  if (isEditing) {
    return (
      <li>
        <form onSubmit={handleSubmit} aria-label={`Rename ${deck.name}`}>
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
        <Link to={`/decks/${deck.id}`}>{deck.name}</Link>
      </h2>
      {deck.description.length > 0 && <p>{deck.description}</p>}
      {deck.tags.length > 0 && (
        <ul aria-label="Tags">
          {deck.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
      <p>
        {deckCards.length} card(s) · {dueCount} due now
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
