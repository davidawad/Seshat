import type { ImageOcclusionContent } from '../../types'
import './image-occlusion.css'

interface ImageOcclusionRevealProps {
  readonly prompt: string
  readonly content: ImageOcclusionContent
  readonly targetRegionId: string
}

/**
 * Reveal-time view of an image-occlusion card: every region's label is
 * shown as a caption over the image (rather than a solid cover), and the
 * region this review actually tested is marked distinctly so the learner
 * can see exactly what they were being asked about.
 */
export const ImageOcclusionReveal = ({ prompt, content, targetRegionId }: ImageOcclusionRevealProps) => (
  <div className="occlusion-image-wrap">
    <img
      src={content.imageDataUrl}
      alt={prompt.trim() !== '' ? `Diagram for: ${prompt}` : 'Diagram'}
      className="occlusion-study-image"
    />
    {content.occlusions.map((region) => (
      <span
        key={region.id}
        className={region.id === targetRegionId ? 'occlusion-box is-revealed is-target' : 'occlusion-box is-revealed'}
        style={{
          left: `${region.xPct}%`,
          top: `${region.yPct}%`,
          width: `${region.widthPct}%`,
          height: `${region.heightPct}%`,
        }}
      >
        {region.label}
      </span>
    ))}
  </div>
)
