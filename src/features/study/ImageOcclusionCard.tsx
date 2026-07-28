import { useId } from 'react'
import type { ImageOcclusionContent } from '../../types'
import './image-occlusion.css'

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
 * Study-time view of an image-occlusion card. Every region on the image is
 * covered so the learner can't peek at labels that aren't in play; the
 * region actually being tested this review is marked distinctly (solid
 * accent box) so there's exactly one unambiguous thing to recall, matching
 * every other card kind's "one clear question" pattern.
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

  return (
    <div className="study-card">
      <p className="study-prompt">{prompt}</p>
      <div className="occlusion-image-wrap">
        <img
          src={content.imageDataUrl}
          alt={prompt.trim() !== '' ? `Diagram for: ${prompt}` : 'Diagram'}
          className="occlusion-study-image"
        />
        {content.occlusions.map((region) => {
          const isTarget = region.id === targetRegionId
          return (
            <span
              key={region.id}
              aria-hidden="true"
              className={isTarget ? 'occlusion-box is-target' : 'occlusion-box'}
              style={{
                left: `${region.xPct}%`,
                top: `${region.yPct}%`,
                width: `${region.widthPct}%`,
                height: `${region.heightPct}%`,
              }}
            >
              {isTarget ? '?' : ''}
            </span>
          )
        })}
      </div>
      <div className="study-field">
        <label htmlFor={inputId}>What&rsquo;s hidden in the highlighted region?</label>
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
