import { useMemo, useState } from 'react'
import { Legible } from '../../components/Legible'
import type { StudyCard } from '../../types'
import { cardFrontBack } from '../study/card-summary'

interface SetPreviewCardProps {
  readonly cards: readonly StudyCard[]
}

/**
 * A single random card from the set, shown as a flip flashcard — the same
 * "get a feel for what's in here" preview Quizlet shows on a set's home
 * page. Purely a preview: no grading, no recordReview, nothing saved.
 */
export const SetPreviewCard = ({ cards }: SetPreviewCardProps) => {
  const [flipped, setFlipped] = useState(false)
  // Fixed for the life of this page view — re-picking on every render would
  // make the card unreadable as you flip it.
  const card = useMemo(() => cards[Math.floor(Math.random() * cards.length)], [cards])

  if (card === undefined) return null

  const { front, back, imageDataUrl } = cardFrontBack(card)

  return (
    <div className="set-preview">
      <Legible as="div" className="illuminated-panel set-preview-face">
        {imageDataUrl !== undefined && <img src={imageDataUrl} alt="" className="set-preview-image" />}
        <p>{flipped ? back : front}</p>
      </Legible>
      <button type="button" onClick={() => setFlipped((current) => !current)}>
        {flipped ? 'Show term' : 'Show definition'}
      </button>
    </div>
  )
}
