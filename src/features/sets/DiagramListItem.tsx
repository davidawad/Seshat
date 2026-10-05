import { Suspense, lazy, useId, useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { DiagramView } from '../../components/DiagramView'
import { Legible } from '../../components/Legible'
import { askedRegion, diagramAlt } from '../../lib/diagram'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import type { SetId, StudyCard } from '../../types'

// The editor (canvas, history, image slot) is only needed once someone edits a diagram, so it
// stays out of the entry bundle.
export const LazyDiagramEditor = lazy(async () => ({ default: (await import('./DiagramEditor')).DiagramEditor }))

interface DiagramListItemProps {
  readonly setId: SetId
  /** All per-label cards of one diagram. */
  readonly cards: readonly StudyCard[]
}

/** One row for a whole diagram (its per-label cards together): thumbnail, labels, Edit and Delete. */
export const DiagramListItem = ({ setId, cards }: DiagramListItemProps) => {
  const { deleteCard } = useSeshatStore()
  const [isEditing, setIsEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const confirmTitleId = useId()
  const first = cards[0]
  if (first === undefined || first.content.kind !== 'image-occlusion') return null
  const content = first.content
  const labels = cards.map((card) => (card.content.kind === 'image-occlusion' ? askedRegion(card.content).label : ''))

  if (isEditing) {
    return (
      <li>
        <Suspense fallback={<p role="status">Loading the diagram editor...</p>}>
          <LazyDiagramEditor setId={setId} cards={cards} onDone={() => setIsEditing(false)} />
        </Suspense>
      </li>
    )
  }

  return (
    <li className="card-list-item">
      <Legible as="p" measure={false}>
        <strong>{first.prompt}</strong> <span className="card-kind-badge">(Labeled diagram)</span>
      </Legible>
      <DiagramView
        image={content.image}
        imageDataUrl={content.imageDataUrl}
        alt={diagramAlt(content.image?.alt, first.prompt)}
        regions={content.occlusions}
        askedId={askedRegion(content).id}
        mode="thumb"
        className="set-term-diagram-thumb"
      />
      <Legible as="p" measure={false}>
        {cards.length} card{cards.length === 1 ? '' : 's'}: {labels.join(', ')}
      </Legible>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        aria-label={`Edit diagram: ${first.prompt}`}
        data-testid={TESTIDS.editCardEdit}
      >
        Edit
      </button>
      <button
        type="button"
        onClick={() => setConfirmingDelete(true)}
        aria-label={`Delete diagram: ${first.prompt}`}
        data-testid={TESTIDS.editCardDelete}
      >
        Delete
      </button>
      {confirmingDelete && (
        <ConfirmDialog
          open
          titleId={confirmTitleId}
          title="Delete this diagram?"
          message={`This removes its ${cards.length} card${cards.length === 1 ? '' : 's'} and their review history. This cannot be undone.`}
          detail={first.prompt}
          confirmLabel="Delete diagram"
          onConfirm={() => cards.forEach((card) => deleteCard(card.id))}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </li>
  )
}
