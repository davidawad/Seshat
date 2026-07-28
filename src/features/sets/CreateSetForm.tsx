import { type FormEvent, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSeshatStore } from '../../lib/store'

/**
 * A clearly visible "+ New set" action, collapsed to a single button until
 * clicked. Creation itself only asks for a name — description, tags, and
 * everything else can be filled in on the set editor page, which is where
 * this sends you immediately after creating (there's nothing to study yet,
 * so the editor is more useful to land on than the empty hub page).
 */
export const CreateSetForm = () => {
  const { addSet } = useSeshatStore()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const nameId = useId()
  const errorId = useId()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      setError('Set name is required.')
      return
    }
    const set = addSet({ name: trimmedName, description: '', tags: [] })
    setName('')
    setError(null)
    setIsOpen(false)
    navigate(`/sets/${set.id}/edit`)
  }

  if (!isOpen) {
    return (
      <button type="button" className="create-set-button" onClick={() => setIsOpen(true)}>
        + New set
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="create-set-form" aria-label="Create a new set">
      <label htmlFor={nameId} className="sr-only">
        Set name
      </label>
      <input
        id={nameId}
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Name your set…"
        aria-invalid={error !== null}
        aria-describedby={error !== null ? errorId : undefined}
        autoFocus
        required
      />
      <button type="submit">Create</button>
      <button
        type="button"
        onClick={() => {
          setIsOpen(false)
          setError(null)
          setName('')
        }}
      >
        Cancel
      </button>
      {error !== null && (
        <p id={errorId} role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
