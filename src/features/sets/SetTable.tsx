import { Link } from 'react-router-dom'
import { TESTIDS } from '../../lib/testids'
import type { StudySet } from '../../types'
import { SetEditLink } from './SetEditLink'
import type { SetMastery } from './set-summary'
import { SetTags } from './SetTags'

export interface SetTableRow {
  readonly set: StudySet
  readonly mastery: SetMastery
}

/** The table view: one row per set with tags, progress, counts, a Study link and an edit link. */
export const SetTable = ({ rows }: { readonly rows: readonly SetTableRow[] }) => (
  <div className="set-table-wrap">
    <table className="set-table" data-testid={TESTIDS.setsBrowserTable}>
      <caption className="sr-only">Sets</caption>
      <thead>
        <tr>
          <th scope="col">Set</th>
          <th scope="col">Memorized</th>
          <th scope="col" className="num">
            Due
          </th>
          <th scope="col" className="num">
            New
          </th>
          <th scope="col" className="num">
            Cards
          </th>
          <th scope="col">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ set, mastery }) => {
          const percent = mastery.total === 0 ? 0 : Math.round((mastery.memorized / mastery.total) * 100)
          return (
            <tr key={set.id} data-testid={TESTIDS.setsBrowserRow}>
              <th scope="row">
                <Link to={`/sets/${set.id}`} data-testid={TESTIDS.setsBrowserSetLink}>
                  {set.name}
                </Link>
                <SetTags tags={set.tags} />
              </th>
              <td>
                <div className="set-table-progress">
                  <div
                    className="set-progress-bar"
                    role="progressbar"
                    aria-label={`${set.name}: ${mastery.memorized} of ${mastery.total} cards memorized`}
                    aria-valuemin={0}
                    aria-valuemax={mastery.total}
                    aria-valuenow={mastery.memorized}
                  >
                    <span className="set-progress-fill" style={{ inlineSize: `${percent}%` }} />
                  </div>
                  <span className="set-progress-count">
                    {mastery.memorized}/{mastery.total}
                  </span>
                </div>
              </td>
              <td className="num">{mastery.due}</td>
              <td className="num">{mastery.newCount}</td>
              <td className="num">{mastery.total}</td>
              <td>
                <div className="set-table-actions">
                  <Link
                    to={`/sets/${set.id}/study`}
                    className="set-table-study"
                    aria-label={`Study ${set.name}`}
                    data-testid={TESTIDS.setsBrowserStudyLink}
                  >
                    Study
                  </Link>
                  <SetEditLink set={set} />
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
    <Link to="/sets/new" className="new-set-row" data-testid={TESTIDS.setsBrowserNewSet}>
      <span aria-hidden="true">+</span> New set
    </Link>
  </div>
)
