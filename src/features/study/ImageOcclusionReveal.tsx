import { DiagramView } from '../../components/DiagramView'
import { diagramAlt } from '../../lib/diagram'
import type { ImageOcclusionContent } from '../../types'

interface ImageOcclusionRevealProps {
  readonly prompt: string
  readonly content: ImageOcclusionContent
  readonly targetRegionId: string
}

/** Reveal-time view of a diagram card: the asked region outlined and captioned with its label. */
export const ImageOcclusionReveal = ({ prompt, content, targetRegionId }: ImageOcclusionRevealProps) => (
  <DiagramView
    image={content.image}
    imageDataUrl={content.imageDataUrl}
    alt={diagramAlt(content.image?.alt, prompt)}
    regions={content.occlusions}
    askedId={targetRegionId}
    mode="answer"
  />
)
