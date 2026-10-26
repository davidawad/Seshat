import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
  type SortDirection,
} from '@tanstack/react-table'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TESTIDS } from '../../lib/testids'
import type { StudySet } from '../../types'
import { SetEditLink } from './SetEditLink'
import { rowMatchesFilter } from './set-table-filter'
import type { SetMastery } from './set-summary'
import { SetTags } from './SetTags'
import { useDebouncedValue } from './use-debounced-value'

export interface SetTableRow {
  readonly set: StudySet
  readonly mastery: SetMastery
}

/** How long typing must pause before the filter is applied. */
const FILTER_DEBOUNCE_MS = 150

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: { text: sortFn_text, basic: sortFn_basic },
})

const helper = createColumnHelper<typeof features, SetTableRow>()

const percentMemorized = ({ mastery }: SetTableRow): number =>
  mastery.total === 0 ? 0 : Math.round((mastery.memorized / mastery.total) * 100)

// asc -> desc -> unsorted on every sortable column (numbers would otherwise start descending).
const sortable = { sortDescFirst: false, enableSortingRemoval: true } as const

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

const ariaSort = (direction: false | SortDirection): 'ascending' | 'descending' | 'none' =>
  direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'

const sortIndicator = (direction: false | SortDirection): string =>
  direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '⇅'

/**
 * The table view: one row per set with tags, progress, counts, a Study link and an edit link.
 * Column headers sort (asc, desc, unsorted); the filter box above matches set name and tags,
 * applied 150ms after typing stops.
 */
export const SetTable = ({ rows }: { readonly rows: readonly SetTableRow[] }) => {
  const [filterInput, setFilterInput] = useState('')
  const filter = useDebouncedValue(filterInput, FILTER_DEBOUNCE_MS)

  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => row.set.id,
    state: { globalFilter: filter },
    getColumnCanGlobalFilter: (column) => column.id === 'name',
    globalFilterFn: (row, _columnId, value: string) => rowMatchesFilter(row.original, value),
  })

  const visibleRows = table.getRowModel().rows

  return (
    <div className="set-table-wrap">
      <input
        type="search"
        className="set-table-filter"
        aria-label="Filter table by name or tag"
        placeholder="Filter by name or tag"
        value={filterInput}
        onChange={(event) => setFilterInput(event.target.value)}
      />
      <table className="set-table" data-testid={TESTIDS.setsBrowserTable}>
        <caption className="sr-only">Sets</caption>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const { column } = header
                const direction = column.getIsSorted()
                return (
                  <th
                    key={header.id}
                    scope="col"
                    className={NUMERIC_COLUMNS.has(column.id) ? 'num' : undefined}
                    aria-sort={column.getCanSort() ? ariaSort(direction) : undefined}
                  >
                    {column.getCanSort() ? (
                      <button type="button" className="set-table-sort" onClick={column.getToggleSortingHandler()}>
                        <table.FlexRender header={header} />
                        <span
                          className="set-table-sort-indicator"
                          aria-hidden="true"
                          data-direction={direction || 'none'}
                        >
                          {sortIndicator(direction)}
                        </span>
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>No sets match &quot;{filter.trim()}&quot;.</td>
            </tr>
          ) : (
            visibleRows.map((row) => (
              <tr key={row.id} data-testid={TESTIDS.setsBrowserRow}>
                {row.getAllCells().map((cell) =>
                  cell.column.id === 'name' ? (
                    <th key={cell.id} scope="row">
                      <table.FlexRender cell={cell} />
                    </th>
                  ) : (
                    <td key={cell.id} className={NUMERIC_COLUMNS.has(cell.column.id) ? 'num' : undefined}>
                      <table.FlexRender cell={cell} />
                    </td>
                  ),
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
      <Link to="/sets/new" className="new-set-row" data-testid={TESTIDS.setsBrowserNewSet}>
        <span aria-hidden="true">+</span> New set
      </Link>
    </div>
  )
}
