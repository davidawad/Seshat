import { useId, useState } from 'react'
import { DeleteIcon, EditIcon } from '../../components/icons'
import { Legible } from '../../components/Legible'
import { useSeshatStore } from '../../lib/store'
import type { StudyCard } from '../../types'
import { CardForm } from './CardForm'

const contentSummary = (card: StudyCard): { readonly label: string; readonly detail: string } => {
  switch (card.content.kind) {
    case 'short-answer':
      return { label: 'Short answer', detail: card.content.answer }
    case 'cloze':
      return { label: 'Cloze', detail: card.content.text }
    case 'mcq': {
      const correct = card.content.options[card.content.correctIndex] ?? '(unknown)'
      return { label: 'Multiple choice', detail: `Correct: ${correct} — ${card.content.options.length} options` }
    }
    case 'image-occlusion': {
      const count = card.content.occlusions.length
      return { label: 'Image occlusion', detail: `${count} hidden region${count === 1 ? '' : 's'}` }
    }
  }
}

interface CardListItemProps {
  readonly card: StudyCard
}

/**
 * Short-answer cards are Seshat's default and by far the most common kind —
 * so a set full of them should read (and edit) like a plain term/definition
 * list, not a form. Other card kinds (cloze/mcq/image-occlusion) carry
 * structure a text box can't represent, so they keep the summary + full
 * editor pattern below.
 */
export const CardListItem = ({ card }: CardListItemProps) => {
  const { updateCard, deleteCard } = useSeshatStore()
  const [isEditing, setIsEditing] = useState(false)
  const [term, setTerm] = useState(card.prompt)
  const [definition, setDefinition] = useState(card.content.kind === 'short-answer' ? card.content.answer : '')
  const termId = useId()
  const definitionId = useId()
  const summary = contentSummary(card)

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Delete this card? This removes its review history too and cannot be undone.\n\nPrompt: ${card.prompt}`,
    )
    if (!confirmed) return
    deleteCard(card.id)
  }

  if (isEditing) {
    return (
      <li>
        <CardForm setId={card.setId} editingCard={card} onDone={() => setIsEditing(false)} />
      </li>
    )
  }

  if (card.content.kind === 'short-answer') {
    const content = card.content

    const saveTerm = () => {
      const trimmed = term.trim()
      if (trimmed.length === 0) {
        setTerm(card.prompt)
        return
      }
      if (trimmed !== card.prompt) updateCard(card.id, { prompt: trimmed })
    }

    const saveDefinition = () => {
      const trimmed = definition.trim()
      if (trimmed.length === 0) {
        setDefinition(content.answer)
        return
      }
      if (trimmed !== content.answer) updateCard(card.id, { content: { ...content, answer: trimmed } })
    }

    return (
      <li className="card-row">
        <label htmlFor={termId} className="sr-only">
          Term
        </label>
        <input
          id={termId}
          type="text"
          className="card-row-input legible"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onBlur={saveTerm}
        />
        <label htmlFor={definitionId} className="sr-only">
          Definition
        </label>
        <input
          id={definitionId}
          type="text"
          className="card-row-input legible"
          value={definition}
          onChange={(event) => setDefinition(event.target.value)}
          onBlur={saveDefinition}
        />
        <button type="button" className="icon-button" onClick={() => setIsEditing(true)} aria-label="More options">
          <EditIcon />
        </button>
        <button type="button" className="icon-button" onClick={handleDelete} aria-label="Delete card">
          <DeleteIcon />
        </button>
      </li>
    )
  }

  return (
    <li className="card-list-item">
      <Legible as="p" measure={false}>
        <strong>{card.prompt}</strong> <span className="card-kind-badge">({summary.label})</span>
      </Legible>
      <Legible as="p" measure={false}>
        {summary.detail}
      </Legible>
      {card.explanation !== null && (
        <Legible as="p" measure={false}>
          {card.explanation}
        </Legible>
      )}
      {card.tags.length > 0 && (
        <ul aria-label="Tags">
          {card.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => setIsEditing(true)}>
        Edit
      </button>
      <button type="button" onClick={handleDelete}>
        Delete
      </button>
    </li>
  )
}
