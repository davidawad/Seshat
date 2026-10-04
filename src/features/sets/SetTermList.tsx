import { CardImage } from '../../components/CardImage'
import { Legible } from '../../components/Legible'
import { TESTIDS } from '../../lib/testids'
import type { StudyCard } from '../../types'
import { cardFrontBack } from '../study/card-summary'

interface SetTermListProps {
  readonly cards: readonly StudyCard[]
}

/**
 * A scannable term/definition table below the mode picker — the same
 * "browse what's actually in here before you commit to a mode" view
 * Quizlet's set page shows inline. Accent-colored header row, alternating
 * row shades, and a Diagram column only when this set actually has a
 * diagram (image) card. Read-only: editing happens on SetEdit.
 */
export const SetTermList = ({ cards }: SetTermListProps) => {
  const rows = cards.map((card) => ({ card, ...cardFrontBack(card) }))
  const hasDiagrams = rows.some((row) => row.image !== null || row.imageDataUrl !== undefined)
  return (
    <div className="set-term-scroll">
      <table className="set-term-table" data-testid={TESTIDS.setTermList}>
        <caption className="sr-only">Terms in this set</caption>
        <thead>
          <tr>
            <th scope="col">Term</th>
            <th scope="col">Definition</th>
            {hasDiagrams && <th scope="col">Diagram</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ card, front, back, image, imageDataUrl }) => (
            <tr key={card.id}>
              <td className="set-term-front">
                <Legible as="span" measure={false}>
                  {front}
                </Legible>
              </td>
              <td className="set-term-back">
                <Legible as="span" measure={false}>
                  {back}
                </Legible>
              </td>
              {hasDiagrams && (
                <td className="set-term-diagram">
                  <CardImage image={image} imageDataUrl={imageDataUrl} alt="" className="set-term-image" />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
