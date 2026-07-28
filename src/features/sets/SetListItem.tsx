import { Link } from 'react-router-dom'
import { EditIcon } from '../../components/icons'
import { isDue } from '../../lib/fsrs'
import type { StudyCard, StudySet } from '../../types'

interface SetListItemProps {
  readonly set: StudySet
  readonly setCards: readonly StudyCard[]
}

/**
 * A single display-only row. Editing (rename/description/tags/delete)
 * lives on the set editor page (`/sets/:id/edit`) — one place to change a
 * set, not a form hidden inside every list row.
 */
export const SetListItem = ({ set, setCards }: SetListItemProps) => {
  const now = new Date()
  const dueCount = setCards.filter((card) => isDue(card.scheduling, now)).length

  return (
    <li className="set-row">
      <Link to={`/sets/${set.id}`} className="set-row-main">
        <span className="set-row-name">{set.name}</span>
        {set.description.length > 0 && <span className="set-row-description">{set.description}</span>}
        {set.tags.length > 0 && (
          <ul aria-label="Tags" className="tag-chips">
            {set.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}
      </Link>
      <span className="set-row-count">
        {setCards.length} card{setCards.length === 1 ? '' : 's'} · {dueCount} due now
      </span>
      <Link to={`/sets/${set.id}/edit`} className="icon-button" aria-label={`Edit ${set.name}`}>
        <EditIcon />
      </Link>
    </li>
  )
}
