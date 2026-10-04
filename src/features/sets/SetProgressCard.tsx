import { Link } from 'react-router-dom'
import { TESTIDS } from '../../lib/testids'
import type { StudySet } from '../../types'
import type { SetMastery } from './set-summary'

interface SetProgressCardProps {
  readonly set: StudySet
  readonly mastery: SetMastery
}

/** A set as a card: name, memorized/total progress widget, and a direct jump into Study. */
export const SetProgressCard = ({ set, mastery }: SetProgressCardProps) => {
  const { memorized, total, due, newCount } = mastery
  const percent = total === 0 ? 0 : Math.round((memorized / total) * 100)
  const nextUp = due + newCount

  return (
    <article className="set-progress-card" aria-label={set.name} data-testid={TESTIDS.homeSetCard}>
      <Link to={`/sets/${set.id}`} className="set-progress-card-main" data-testid={TESTIDS.homeSetLink}>
        <h2 className="set-progress-card-name">{set.name}</h2>
        {set.description.length > 0 && <p className="set-progress-card-description">{set.description}</p>}
      </Link>
      <div className="set-progress">
        <div
          className="set-progress-bar"
          role="progressbar"
          aria-label={`${set.name}: ${memorized} of ${total} cards memorized`}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={memorized}
        >
          <span className="set-progress-fill" style={{ inlineSize: `${percent}%` }} />
        </div>
        <span className="set-progress-count">
          {memorized}/{total}
        </span>
      </div>
      <p className="set-progress-card-meta">{nextUp === 0 ? 'Nothing due' : `${due} due · ${newCount} new`}</p>
      <Link
        to={`/sets/${set.id}/study`}
        className="set-progress-card-study"
        aria-label={`Study ${set.name}`}
        data-testid={TESTIDS.homeStudyLink}
      >
        Study
      </Link>
    </article>
  )
}
