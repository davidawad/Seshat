import { Link } from 'react-router-dom'
import { EditIcon } from '../../components/icons'
import { TESTIDS } from '../../lib/testids'
import type { StudySet } from '../../types'

/** Pencil icon link to a set's editor, shared by the card and table views. */
export const SetEditLink = ({ set }: { readonly set: StudySet }) => (
  <Link
    to={`/sets/${set.id}/edit`}
    className="icon-button"
    aria-label={`Edit ${set.name}`}
    title="Edit"
    data-testid={TESTIDS.setsBrowserEditLink}
  >
    <EditIcon />
  </Link>
)
