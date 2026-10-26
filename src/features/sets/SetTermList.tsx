import { useMemo, useState } from 'react'
import { CardImage } from '../../components/CardImage'
import { DataTable, dataTableHelper, sortableColumn as sortable } from '../../components/DataTable'
import { Legible } from '../../components/Legible'
import { MediaImage } from '../../lib/media'
import { TESTIDS } from '../../lib/testids'
import { useDebouncedValue } from '../../lib/use-debounced-value'
import type { StudyCard } from '../../types'
import { DiagramView } from '../../components/DiagramView'
import { cardFrontBack } from '../study/card-summary'

/** How long typing must pause before the card filter is applied. */
const FILTER_DEBOUNCE_MS = 150

interface SetTermListProps {
  readonly cards: readonly StudyCard[]
}

interface TermRow {
  readonly card: StudyCard
  readonly front: string
  readonly back: string
  readonly termImage: ReturnType<typeof cardFrontBack>['image']
  readonly definitionImage: ReturnType<typeof cardFrontBack>['answerImage']
  readonly image: ReturnType<typeof cardFrontBack>['image']
  readonly imageDataUrl: ReturnType<typeof cardFrontBack>['imageDataUrl']
  readonly diagram: ReturnType<typeof cardFrontBack>['diagram']
}

const helper = dataTableHelper<TermRow>()

const termColumn = helper.accessor((row) => row.front, {
  id: 'term',
  header: 'Term',
  ...sortable,
  sortFn: 'text',
  cell: ({ row: { original } }) => (
    <>
      <Legible as="span" measure={false}>
        {original.front}
      </Legible>
      {original.termImage && (
        <span data-testid={TESTIDS.setTermImage}>
          <MediaImage media={original.termImage} className="set-term-image" />
        </span>
      )}
    </>
  ),
})

const definitionColumn = helper.accessor((row) => row.back, {
  id: 'definition',
  header: 'Definition',
  ...sortable,
  sortFn: 'text',
  cell: ({ row: { original } }) => (
    <>
      <Legible as="span" measure={false}>
        {original.back}
      </Legible>
      {original.definitionImage && (
        <span data-testid={TESTIDS.setDefinitionImage}>
          <MediaImage media={original.definitionImage} className="set-term-image" />
        </span>
      )}
    </>
  ),
})

const diagramColumn = helper.display({
  id: 'diagram',
  header: 'Diagram',
  enableSorting: false,
  cell: ({ row: { original } }) =>
    original.diagram === undefined ? (
      <CardImage image={original.image} imageDataUrl={original.imageDataUrl} alt="" className="set-term-image" />
    ) : (
      <span data-testid={TESTIDS.setDiagramThumb}>
        <DiagramView
          image={original.image}
          imageDataUrl={original.imageDataUrl}
          alt=""
          regions={original.diagram.regions}
          askedId={original.diagram.askedId}
          mode="thumb"
          className="set-term-diagram-thumb"
        />
      </span>
    ),
})

const COLUMNS = helper.columns([termColumn, definitionColumn])
const COLUMNS_WITH_DIAGRAM = helper.columns([termColumn, definitionColumn, diagramColumn])

const CELL_CLASS: Readonly<Record<string, string>> = {
  term: 'set-term-front',
  definition: 'set-term-back',
  diagram: 'set-term-diagram',
}

const rowMatches = ({ front, back }: TermRow, value: string): boolean => {
  const needle = value.trim().toLowerCase()
  return needle.length === 0 || front.toLowerCase().includes(needle) || back.toLowerCase().includes(needle)
}

/**
 * A scannable term/definition table below the mode picker — the same
 * "browse what's actually in here before you commit to a mode" view
 * Quizlet's set page shows inline. Accent-colored header row, alternating
 * row shades, and a Diagram column only when this set actually has a
 * diagram (image) card. Headers sort; the filter box matches term or
 * definition text 150ms after typing stops. Read-only: editing happens on SetEdit.
 */
export const SetTermList = ({ cards }: SetTermListProps) => {
  const [filterInput, setFilterInput] = useState('')
  const filter = useDebouncedValue(filterInput, FILTER_DEBOUNCE_MS)
  const rows = useMemo<readonly TermRow[]>(
    () =>
      cards.map((card) => {
        const faces = cardFrontBack(card)
        // An occlusion card's image is its diagram; any other card's image is the term's own picture.
        const isDiagram = card.content.kind === 'image-occlusion'
        return {
          card,
          front: faces.front,
          back: faces.back,
          termImage: isDiagram ? undefined : faces.image,
          definitionImage: faces.answerImage,
          image: isDiagram ? faces.image : undefined,
          imageDataUrl: faces.imageDataUrl,
          diagram: faces.diagram,
        }
      }),
    [cards],
  )
  const hasDiagrams = rows.some((row) => Boolean(row.image) || row.imageDataUrl !== undefined)
  return (
    <>
      <input
        type="search"
        className="data-table-filter"
        aria-label="Filter cards by term or definition"
        placeholder="Filter cards"
        value={filterInput}
        onChange={(event) => setFilterInput(event.target.value)}
      />
      <div className="set-term-scroll">
        <DataTable
          data={rows}
          columns={hasDiagrams ? COLUMNS_WITH_DIAGRAM : COLUMNS}
          getRowId={(row) => row.card.id}
          caption="Terms in this set"
          className="set-term-table"
          testId={TESTIDS.setTermList}
          cellClass={(id) => CELL_CLASS[id]}
          filter={{ value: filter, matches: rowMatches }}
          emptyMessage={filter.trim() === '' ? undefined : `No cards match "${filter.trim()}".`}
        />
      </div>
    </>
  )
}
