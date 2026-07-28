import { type FormEvent, useId, useState } from 'react'
import { useSeshatStore } from '../../lib/store'
import type { DeckId } from '../../types'
import { parseTagsInput } from './tags'

interface CreateDeckFormProps {
  readonly onCreated: (deckId: DeckId) => void
}

export const CreateDeckForm = ({ onCreated }: CreateDeckFormProps) => {
  const { addDeck } = useSeshatStore()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const nameId = useId()
  const descriptionId = useId()
  const tagsId = useId()
  const errorId = useId()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      setError('Deck name is required.')
      return
    }
    setError(null)
    const deck = addDeck({ name: trimmedName, description: description.trim(), tags: parseTagsInput(tagsText) })
    setName('')
    setDescription('')
    setTagsText('')
    onCreated(deck.id)
  }

  return (
    <form onSubmit={handleSubmit} aria-labelledby="create-deck-heading">
      <h2 id="create-deck-heading">Create a new deck</h2>
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
        <label htmlFor={descriptionId}>Description (optional)</label>
        <textarea
          id={descriptionId}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
        />
      </div>
      <div>
        <label htmlFor={tagsId}>Tags (comma-separated, optional)</label>
        <input id={tagsId} type="text" value={tagsText} onChange={(event) => setTagsText(event.target.value)} />
      </div>
      {error !== null && (
        <p id={errorId} role="alert">
          {error}
        </p>
      )}
      <button type="submit">Create deck</button>
    </form>
  )
}
