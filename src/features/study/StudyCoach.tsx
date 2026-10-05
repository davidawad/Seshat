import { Link } from 'react-router-dom'
import { TESTIDS } from '../../lib/testids'
import type { SetId } from '../../types'

interface StudyCoachProps {
  readonly setId: SetId
  readonly onDismiss: () => void
}

/**
 * One plain line, shown on the first Study session only, that explains the loop a new
 * user cannot guess: type from memory, rate yourself, FSRS schedules the next review.
 * "Just flip cards" is the way out for anyone who finds typing too much.
 */
export const StudyCoach = ({ setId, onDismiss }: StudyCoachProps) => (
  <aside className="study-coach" aria-label="How studying works" data-testid={TESTIDS.studyCoach}>
    <p className="study-coach-text">
      Type what you remember and press Enter, then rate how well you recalled it. Seshat uses FSRS, a model of when you
      will forget, to schedule the next review.{' '}
      <Link to={`/sets/${setId}/flashcards`} data-testid={TESTIDS.studyCoachFlip} onClick={onDismiss}>
        Just flip cards
      </Link>
    </p>
    <button type="button" className="study-coach-dismiss" data-testid={TESTIDS.studyCoachDismiss} onClick={onDismiss}>
      Got it
    </button>
  </aside>
)
