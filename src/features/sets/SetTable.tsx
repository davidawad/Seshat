import { Link } from 'react-router-dom'
import { TESTIDS } from '../../lib/testids'
import type { StudySet } from '../../types'
import type { SetMastery } from './set-summary'

export interface SetTableRow {
  readonly set: StudySet
  readonly mastery: SetMastery
}

/** The home page's table view: one row per set with progress, due/new counts and a Study link. */
export const SetTable = ({ rows }: { readonly rows: readonly SetTableRow[] }) => (
  <div className="set-table-wrap">
    <table className="set-table" data-testid={TESTIDS.homeSetTable}>
      <caption className="sr-only">Your sets</caption>
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
            <tr key={set.id} data-testid={TESTIDS.homeSetRow}>
              <th scope="row">
                <Link to={`/sets/${set.id}`}>{set.name}</Link>
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
                <Link to={`/sets/${set.id}/study`} className="set-table-study" aria-label={`Study ${set.name}`}>
                  Study
                </Link>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
    <Link to="/sets/new" className="new-set-row" data-testid={TESTIDS.homeNewSet}>
      <span aria-hidden="true">+</span> New set
    </Link>
  </div>
)
