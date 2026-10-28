import { Link } from 'react-router-dom'
import { DataTable, dataTableHelper, sortableColumn as sortable } from '../../components/DataTable'
import { type ScopeSummary, formatPercent } from './scope'

export interface BreakdownRow {
  readonly id: string
  readonly name: string
  /** Where the name links to (the set's or folder's own stats). */
  readonly href: string
  readonly summary: ScopeSummary
  /** Router state passed with the name link (e.g. which folder the learner came from). */
  readonly linkState?: unknown
}

const helper = dataTableHelper<BreakdownRow>()

const number = (id: string, header: string, value: (row: BreakdownRow) => number) =>
  helper.accessor(value, { id, header, ...sortable, sortFn: 'basic' })

const COLUMNS = helper.columns([
  helper.accessor((row) => row.name, {
    id: 'name',
    header: 'Name',
    ...sortable,
    sortFn: 'text',
    cell: ({ row }) => (
      <Link to={row.original.href} state={row.original.linkState}>
        {row.original.name}
      </Link>
    ),
  }),
  number('cards', 'Cards', (row) => row.summary.cardCount),
  number('due', 'Due', (row) => row.summary.due),
  number('new', 'New', (row) => row.summary.newCount),
  number('reviews', 'Reviews', (row) => row.summary.reviewsTotal),
  helper.accessor((row) => row.summary.correctRate ?? -1, {
    id: 'correct',
    header: 'Correct',
    ...sortable,
    sortFn: 'basic',
    cell: ({ row }) =>
      row.original.summary.correctRate === null ? '—' : formatPercent(row.original.summary.correctRate),
  }),
  helper.accessor((row) => row.summary.retention ?? -1, {
    id: 'retention',
    header: 'Retention',
    ...sortable,
    sortFn: 'basic',
    cell: ({ row }) => (row.original.summary.retention === null ? '—' : formatPercent(row.original.summary.retention)),
  }),
])

const NUMERIC = new Set(['cards', 'due', 'new', 'reviews', 'correct', 'retention'])

/** One row of numbers per set (or folder): the "which one needs work" view. */
export const ScopeBreakdown = ({
  rows,
  caption,
  testId,
}: {
  readonly rows: readonly BreakdownRow[]
  readonly caption: string
  readonly testId: string
}) => (
  <div className="table-scroll">
    <DataTable
      data={rows}
      columns={COLUMNS}
      getRowId={(row) => row.id}
      caption={caption}
      testId={testId}
      rowHeaderColumn="name"
      numericColumns={NUMERIC}
    />
  </div>
)
