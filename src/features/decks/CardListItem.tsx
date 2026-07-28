import { useState } from 'react'
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

export const CardListItem = ({ card }: CardListItemProps) => {
  const { deleteCard } = useSeshatStore()
  const [isEditing, setIsEditing] = useState(false)
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
        <CardForm deckId={card.deckId} editingCard={card} onDone={() => setIsEditing(false)} />
      </li>
    )
  }

  return (
    <li>
      <p>
        <strong>{card.prompt}</strong> <span>({summary.label})</span>
      </p>
      <p>{summary.detail}</p>
      {card.explanation !== null && <p>{card.explanation}</p>}
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
