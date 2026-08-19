import { Legible } from '../../components/Legible'
import type { StudyCard } from '../../types'
import { cardFrontBack } from '../study/card-summary'

interface SetTermListProps {
  readonly cards: readonly StudyCard[]
}

/**
 * A scannable term/definition list below the mode picker — the same
 * "browse what's actually in here before you commit to a mode" view
 * Quizlet's set page shows inline. Read-only: editing happens on SetEdit
 * (see SetDetail's own comment on why this page isn't a card console).
 */
export const SetTermList = ({ cards }: SetTermListProps) => (
  <ul className="set-term-list" aria-label="Terms in this set">
    {cards.map((card) => {
      const { front, back, imageDataUrl } = cardFrontBack(card)
      return (
        <li key={card.id} className="set-term-row">
          <Legible as="span" measure={false} className="set-term-front">
            {imageDataUrl !== undefined && <img src={imageDataUrl} alt="" className="set-term-image" />}
            {front}
          </Legible>
          <Legible as="span" measure={false} className="set-term-back">
            {back}
          </Legible>
        </li>
      )
    })}
  </ul>
)
