import { useId } from 'react'
import { DiagramView } from '../../components/DiagramView'
import { diagramAlt } from '../../lib/diagram'
import { useSeshatStore } from '../../lib/store'
import type { ImageOcclusionContent } from '../../types'

interface ImageOcclusionCardProps {
  readonly prompt: string
  readonly content: ImageOcclusionContent
  /** Which region this particular review is asking about (see `pickOcclusionRegion`). */
  readonly targetRegionId: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly disabled: boolean
}

/**
 * Study-time view of a diagram card. Only the region being asked about is
 * masked (the others stay visible) unless the "Hide all labels" setting is
 * on, in which case every region is masked and the asked one is marked.
 */
export const ImageOcclusionCard = ({
  prompt,
  content,
  targetRegionId,
  value,
  onChange,
  disabled,
}: ImageOcclusionCardProps) => {
  const inputId = useId()
  const { state } = useSeshatStore()

  return (
    <div className="study-card">
      <p className="study-prompt">{prompt}</p>
      <DiagramView
        image={content.image}
        imageDataUrl={content.imageDataUrl}
        alt={diagramAlt(content.image?.alt, prompt)}
        regions={content.occlusions}
        askedId={targetRegionId}
        mode="question"
        hideAll={state.settings.diagramHideAllLabels}
      />
      <div className="study-field">
        <label htmlFor={inputId}>What&rsquo;s hidden in the marked region?</label>
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          autoComplete="off"
          autoFocus={!disabled}
        />
      </div>
    </div>
  )
}
