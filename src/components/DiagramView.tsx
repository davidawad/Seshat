import { describePosition, maskedRegionIds } from '../lib/diagram'
import type { MediaRef } from '../lib/media/types'
import type { OcclusionRegion } from '../types'
import { CardImage } from './CardImage'
import '../features/study/image-occlusion.css'

export type DiagramMode = 'question' | 'answer' | 'thumb'

interface DiagramViewProps {
  readonly image: MediaRef | null | undefined
  /** LEGACY inline data URL, shown only when there is no `image`. */
  readonly imageDataUrl?: string | undefined
  readonly alt: string
  readonly regions: readonly OcclusionRegion[]
  /** The region this card asks about. */
  readonly askedId: string
  /**
   * question: the asked region is masked (every region with `hideAll`);
   * answer: the asked region is outlined and captioned with its label;
   * thumb: a small question-side picture for lists (masks only, no text).
   */
  readonly mode: DiagramMode
  readonly hideAll?: boolean
  readonly className?: string
}

const place = (region: OcclusionRegion) => ({
  left: `${region.xPct}%`,
  top: `${region.yPct}%`,
  width: `${region.widthPct}%`,
  height: `${region.heightPct}%`,
})

/** What a screen reader gets in place of the (decorative) boxes: what is hidden / revealed, and where. */
const noteFor = (mode: DiagramMode, asked: OcclusionRegion | undefined, count: number, hideAll: boolean) => {
  if (asked === undefined || mode === 'thumb') return null
  const where = describePosition(asked)
  if (mode === 'answer') return `Answer: ${asked.label}, ${where} region.`
  const others = hideAll && count > 1 ? `, and ${plural(count - 1, 'other region')}` : ''
  return `Hidden: the label for the ${where} region${others}.`
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

const Mask = ({ region, glyph, isTarget }: { region: OcclusionRegion; glyph: string; isTarget: boolean }) => (
  <span
    aria-hidden="true"
    data-region={region.id}
    className={isTarget ? 'occlusion-box is-target' : 'occlusion-box'}
    style={place(region)}
  >
    {glyph}
  </span>
)

const Reveal = ({ region }: { region: OcclusionRegion }) => (
  <span aria-hidden="true" data-region={region.id} className="occlusion-reveal" style={place(region)}>
    <span className={region.xPct + region.widthPct / 2 > 50 ? 'occlusion-chip is-right' : 'occlusion-chip'}>
      {region.label}
    </span>
  </span>
)

/**
 * One diagram as shown to a learner: the image with its masks or its revealed
 * label. Information never rests on colour alone: the asked mask carries a
 * "?" and a heavy solid border, other masks a dashed border and their number,
 * the revealed label is text. The boxes are decorative; a visually hidden
 * sentence states what is hidden and where.
 */
export const DiagramView = ({
  image,
  imageDataUrl,
  alt,
  regions,
  askedId,
  mode,
  hideAll = false,
  className,
}: DiagramViewProps) => {
  const masked = mode === 'answer' ? new Set<string>() : maskedRegionIds(regions, askedId, hideAll)
  const note = noteFor(
    mode,
    regions.find((region) => region.id === askedId),
    regions.length,
    hideAll,
  )
  const glyph = (region: OcclusionRegion, index: number) =>
    mode === 'thumb' ? '' : region.id === askedId ? '?' : String(index + 1)
  return (
    <div className={className === undefined ? 'occlusion-image-wrap' : `occlusion-image-wrap ${className}`}>
      <CardImage image={image} imageDataUrl={imageDataUrl} alt={alt} className="occlusion-study-image" />
      {regions.map((region, index) =>
        masked.has(region.id) ? (
          <Mask key={region.id} region={region} glyph={glyph(region, index)} isTarget={region.id === askedId} />
        ) : mode === 'answer' && region.id === askedId ? (
          <Reveal key={region.id} region={region} />
        ) : null,
      )}
      {note !== null && <span className="sr-only">{note}</span>}
    </div>
  )
}
