import type { ReactNode } from 'react'
import type { MediaRef } from '../lib/media/types'
import { diagramAlt } from '../lib/diagram'
import type { CardFrontBack } from '../features/study/card-summary'
import { CardImage } from './CardImage'
import { DiagramView } from './DiagramView'
import './flip-card.css'

interface FlipCardProps {
  readonly front: string
  readonly back: string
  readonly image?: MediaRef | undefined
  /** Shown on the back face in place of `image` when present. */
  readonly answerImage?: MediaRef | undefined
  /** LEGACY inline data URL; shown only when `image` is absent. */
  readonly imageDataUrl: string | undefined
  /** Diagram cards: draws the masked question and revealed answer in place of the plain image. */
  readonly diagram?: CardFrontBack['diagram'] | undefined
  readonly hideAllLabels?: boolean
  /** The 'definition first' orientation: the label side leads, so the front shows the revealed diagram. */
  readonly diagramSwapped?: boolean
  readonly flipped: boolean
  /** Footer rendered inside BOTH faces (overlaid at the bottom edge), so it turns with the card. */
  readonly tip?: ReactNode
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
 * Diagram (image-occlusion) cards pass `diagram`: the front draws the image
 * with the asked region masked (every region with `hideAll`), the back draws
 * it with that region outlined and labelled.
 */ export const FlipCard = ({
  front,
  back,
  image,
  answerImage,
  imageDataUrl,
  diagram,
  hideAllLabels = false,
  diagramSwapped = false,
  flipped,
  tip,
}: FlipCardProps) => (
  <div className="flip-card-scene">
    <div className={flipped ? 'flip-card-inner is-flipped' : 'flip-card-inner'}>
      <div className="legible illuminated-panel flip-card-face flip-card-front" aria-hidden={flipped}>
        {diagram === undefined ? (
          <CardImage image={image} imageDataUrl={imageDataUrl} alt="" className="flip-card-image" />
        ) : (
          <DiagramView
            image={image}
            imageDataUrl={imageDataUrl}
            alt={diagramAlt(diagram.alt, front)}
            regions={diagram.regions}
            askedId={diagram.askedId}
            mode={diagramSwapped ? 'answer' : 'question'}
            hideAll={hideAllLabels}
            className="flip-card-diagram"
          />
        )}
        <p>{front}</p>
        {tip}
      </div>
      <div className="legible illuminated-panel flip-card-face flip-card-back" aria-hidden={!flipped}>
        {diagram === undefined ? (
          <CardImage
            image={answerImage ?? image}
            imageDataUrl={answerImage ? undefined : imageDataUrl}
            alt=""
            className="flip-card-image"
          />
        ) : (
          <DiagramView
            image={image}
            imageDataUrl={imageDataUrl}
            alt={diagramAlt(diagram.alt, front)}
            regions={diagram.regions}
            askedId={diagram.askedId}
            mode={diagramSwapped ? 'question' : 'answer'}
            hideAll={hideAllLabels}
            className="flip-card-diagram"
          />
        )}
        <p>{back}</p>
        {tip}
      </div>
    </div>
  </div>
)
