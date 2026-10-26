import { Link } from 'react-router-dom'
import { DataTable, dataTableHelper, sortableColumn as sortable } from '../../components/DataTable'
import { TESTIDS } from '../../lib/testids'
import type { StudySet } from '../../types'
import { SetEditLink } from './SetEditLink'
import type { SetMastery } from './set-summary'
import { SetTags } from './SetTags'

export interface SetTableRow {
  readonly set: StudySet
  readonly mastery: SetMastery
}

const helper = dataTableHelper<SetTableRow>()

const percentMemorized = ({ mastery }: SetTableRow): number =>
  mastery.total === 0 ? 0 : Math.round((mastery.memorized / mastery.total) * 100)

const columns = helper.columns([
  helper.accessor((row) => row.set.name, {
    id: 'name',
    header: 'Set',
    ...sortable,
    sortFn: 'text',
    cell: ({ row }) => (
      <>
        <Link to={`/sets/${row.original.set.id}`} data-testid={TESTIDS.setsBrowserSetLink}>
          {row.original.set.name}
        </Link>
        <SetTags tags={row.original.set.tags} />
      </>
    ),
  }),
  helper.accessor(percentMemorized, {
    id: 'memorized',
    header: 'Memorized',
    ...sortable,
    sortFn: 'basic',
    cell: ({ row: { original } }) => {
      const { set, mastery } = original
      return (
        <div className="set-table-progress">
          <div
            className="set-progress-bar"
            role="progressbar"
            aria-label={`${set.name}: ${mastery.memorized} of ${mastery.total} cards memorized`}
            aria-valuemin={0}
            aria-valuemax={mastery.total}
            aria-valuenow={mastery.memorized}
          >
            <span className="set-progress-fill" style={{ inlineSize: `${percentMemorized(original)}%` }} />
          </div>
          <span className="set-progress-count">
            {mastery.memorized}/{mastery.total}
          </span>
        </div>
      )
    },
  }),
  helper.accessor((row) => row.mastery.due, { id: 'due', header: 'Due', ...sortable, sortFn: 'basic' }),
  helper.accessor((row) => row.mastery.newCount, { id: 'new', header: 'New', ...sortable, sortFn: 'basic' }),
  helper.accessor((row) => row.mastery.total, { id: 'cards', header: 'Cards', ...sortable, sortFn: 'basic' }),
  helper.display({
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    enableSorting: false,
    cell: ({ row: { original } }) => (
      <div className="set-table-actions">
        <Link
          to={`/sets/${original.set.id}/study`}
          className="set-table-study"
          aria-label={`Study ${original.set.name}`}
          data-testid={TESTIDS.setsBrowserStudyLink}
        >
          Study
        </Link>
        <SetEditLink set={original.set} />
      </div>
    ),
  }),
])

const NUMERIC_COLUMNS: ReadonlySet<string> = new Set(['due', 'new', 'cards'])

/**
 * The table view: one row per set with tags, progress, counts, a Study link and an edit link.
 * Column headers sort (asc, desc, unsorted). Filtering is the page-level search upstream.
 */
export const SetTable = ({ rows }: { readonly rows: readonly SetTableRow[] }) => (
  <div className="set-table-wrap">
    <DataTable
      data={rows}
      columns={columns}
      getRowId={(row) => row.set.id}
      caption="Sets"
      className="set-table"
      testId={TESTIDS.setsBrowserTable}
      rowTestId={TESTIDS.setsBrowserRow}
      rowHeaderColumn="name"
      numericColumns={NUMERIC_COLUMNS}
    />
    <Link to="/sets/new" className="new-set-row" data-testid={TESTIDS.setsBrowserNewSet}>
      <span aria-hidden="true">+</span> New set
    </Link>
  </div>
)
