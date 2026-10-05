import { useId } from 'react'
import { DiagramView } from '../../components/DiagramView'
import { Legible } from '../../components/Legible'
import { TESTIDS } from '../../lib/testids'
import type { OcclusionRegion } from '../../types'
import type { DiagramDraft } from './use-diagram-editor'

interface DiagramRegionListProps {
  readonly regions: readonly OcclusionRegion[]
  readonly onSelect: (id: string) => void
  readonly onLabel: (id: string, label: string) => void
  readonly onDelete: (id: string) => void
}

/** One labelled text field and a delete button per region (the label is what the card asks for). */
export const DiagramRegionList = ({ regions, onSelect, onLabel, onDelete }: DiagramRegionListProps) => {
  const baseId = useId()
  return (
    <ol className="diagram-region-list" aria-label="Region labels">
      {regions.map((region, index) => {
        const labelId = `${baseId}-label-${region.id}`
        const named = region.label.trim() === '' ? '' : `: ${region.label}`
        return (
          <li key={region.id} className="diagram-region-item">
            <label htmlFor={labelId}>Label for region {index + 1}</label>
            <Legible as="span" measure={false}>
              <input
                id={labelId}
                type="text"
                data-testid={TESTIDS.diagramRegionLabel}
                value={region.label}
                aria-invalid={region.label.trim() === ''}
                onFocus={() => onSelect(region.id)}
                onChange={(event) => onLabel(region.id, event.target.value)}
              />
            </Legible>
            <button
              type="button"
              data-testid={TESTIDS.diagramRegionDelete}
              aria-label={`Delete region ${index + 1}${named}`}
              onClick={() => onDelete(region.id)}
            >
              Delete
            </button>
          </li>
        )
      })}
    </ol>
  )
}

interface DiagramPreviewsProps {
  readonly draft: DiagramDraft
  readonly alt: string
  readonly askedId: string
  readonly hideAll: boolean
}

/** The question and answer side of the selected region's card, updating live as the draft changes. */
export const DiagramPreviews = ({ draft, alt, askedId, hideAll }: DiagramPreviewsProps) => {
  const number = draft.regions.findIndex((region) => region.id === askedId) + 1
  const common = { image: draft.image, imageDataUrl: draft.imageDataUrl, alt, regions: draft.regions, askedId }
  return (
    <div className="diagram-previews" data-testid={TESTIDS.diagramPreview}>
      <figure>
        <figcaption>Question side (region {number})</figcaption>
        <DiagramView {...common} mode="question" hideAll={hideAll} />
      </figure>
      <figure>
        <figcaption>Answer side</figcaption>
        <DiagramView {...common} mode="answer" />
      </figure>
    </div>
  )
}
