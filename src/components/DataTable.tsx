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
  type ColumnDef,
  type RowData,
  type SortDirection,
} from '@tanstack/react-table'
import type { ReactNode } from 'react'
import './data-table.css'

export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: { text: sortFn_text, basic: sortFn_basic },
})

export type DataTableColumn<T extends RowData> = ColumnDef<typeof dataTableFeatures, T>

/** Column helper bound to the shared feature set. */
export const dataTableHelper = <T extends RowData>() => createColumnHelper<typeof dataTableFeatures, T>()

/** asc -> desc -> unsorted on every sortable column (numbers would otherwise start descending). */
export const sortableColumn = { sortDescFirst: false, enableSortingRemoval: true } as const

const ariaSort = (direction: false | SortDirection): 'ascending' | 'descending' | 'none' =>
  direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'

const sortIndicator = (direction: false | SortDirection): string =>
  direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '⇅'

interface DataTableProps<T extends RowData> {
  readonly data: readonly T[]
  readonly columns: readonly DataTableColumn<T>[]
  readonly getRowId: (row: T) => string
  /** Screen-reader caption. */
  readonly caption: string
  readonly className?: string
  readonly testId?: string
  readonly rowTestId?: string
  /** Column rendered as the row header (`<th scope="row">`). */
  readonly rowHeaderColumn?: string
  /** Columns right-aligned with tabular numerals (header and cells). */
  readonly numericColumns?: ReadonlySet<string>
  /** Extra class for a column's body cells. */
  readonly cellClass?: (columnId: string) => string | undefined
  /** Row filter; rows are kept when `matches` returns true for the (debounced) value. */
  readonly filter?: { readonly value: string; readonly matches: (row: T, value: string) => boolean }
  readonly emptyMessage?: ReactNode
}

/**
 * Table on TanStack: sortable headers (buttons inside `th[aria-sort]`, asc, desc, unsorted)
 * and an optional row filter. Columns that set `enableSorting: false` render a plain header.
 */
export const DataTable = <T extends RowData>({
  data,
  columns,
  getRowId,
  caption,
  className,
  testId,
  rowTestId,
  rowHeaderColumn,
  numericColumns,
  cellClass,
  filter,
  emptyMessage,
}: DataTableProps<T>) => {
  const table = useTable({
    features: dataTableFeatures,
    columns: [...columns],
    data: [...data],
    getRowId,
    state: { globalFilter: filter?.value ?? '' },
    globalFilterFn: (row, _columnId, value: string) => filter === undefined || filter.matches(row.original, value),
  })
  const rows = table.getRowModel().rows
  const numeric = (id: string) => (numericColumns?.has(id) ? 'num' : undefined)

  return (
    <table className={['data-table', className].filter(Boolean).join(' ')} data-testid={testId}>
      <caption className="sr-only">{caption}</caption>
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
                  className={numeric(column.id)}
                  aria-sort={column.getCanSort() ? ariaSort(direction) : undefined}
                >
                  {column.getCanSort() ? (
                    <button type="button" className="data-table-sort" onClick={column.getToggleSortingHandler()}>
                      <table.FlexRender header={header} />
                      <span
                        className="data-table-sort-indicator"
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
        {rows.length === 0 && emptyMessage !== undefined ? (
          <tr>
            <td colSpan={columns.length}>{emptyMessage}</td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.id} data-testid={rowTestId}>
              {row.getAllCells().map((cell) =>
                cell.column.id === rowHeaderColumn ? (
                  <th key={cell.id} scope="row">
                    <table.FlexRender cell={cell} />
                  </th>
                ) : (
                  <td
                    key={cell.id}
                    className={
                      [numeric(cell.column.id), cellClass?.(cell.column.id)].filter(Boolean).join(' ') || undefined
                    }
                  >
                    <table.FlexRender cell={cell} />
                  </td>
                ),
              )}
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}
