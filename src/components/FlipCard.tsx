import type { MediaRef } from '../lib/media/types'
import { CardImage } from './CardImage'
import './flip-card.css'

interface FlipCardProps {
  readonly front: string
  readonly back: string
  readonly image?: MediaRef | undefined
  /** LEGACY inline data URL; shown only when `image` is absent. */
  readonly imageDataUrl: string | undefined
  readonly flipped: boolean
}

/**
 * A two-sided index card that physically turns over: each side is its own
 * `.illuminated-panel` (background, border, padding), so the whole card
 * rotates — not just the text sitting on a stationary card. Presentational
 * only; the flashcard session and the set-page preview each wrap it with
 * their own interaction (swipe/keyboard vs a plain button). The side that
 * is turned away is `aria-hidden` so a screen reader reads one face at a
 * time. Reduced motion is handled globally (typography.css zeroes
 * transitions), so the flip simply swaps instantly there.
 *
 * KNOWN LIMITATION (image-occlusion cards): both faces show the same
 * UN-occluded image, and the card only asks about the first region (`back`
 * is region 1's label via `cardFrontBack`), so the other regions are never
 * quizzed and the answer is visible on the front. Study mode renders these
 * cards properly (ImageOcclusionCard); Flashcards only keeps them reachable.
 * TODO(image-cards): render the front with all regions masked and the back
 * with the asked region revealed, or ask every region. Not redesigned here.
 */
export const FlipCard = ({ front, back, image, imageDataUrl, flipped }: FlipCardProps) => (
  <div className="flip-card-scene">
    <div className={flipped ? 'flip-card-inner is-flipped' : 'flip-card-inner'}>
      <div className="legible illuminated-panel flip-card-face flip-card-front" aria-hidden={flipped}>
        <CardImage image={image} imageDataUrl={imageDataUrl} alt="" className="flip-card-image" />
        <p>{front}</p>
      </div>
      <div className="legible illuminated-panel flip-card-face flip-card-back" aria-hidden={!flipped}>
        <CardImage image={image} imageDataUrl={imageDataUrl} alt="" className="flip-card-image" />
        <p>{back}</p>
      </div>
    </div>
  </div>
)
