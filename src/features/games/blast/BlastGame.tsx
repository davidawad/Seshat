import { cardFrontBack } from '../../study/card-summary'
import type { GameSessionProps } from '../types'
import { BlastSession } from './BlastSession'
import type { BlastPair } from './round'

export const BlastGame = ({ setId, cards }: GameSessionProps) => {
  const pairs: BlastPair[] = cards.map((card) => {
    const { front, back } = cardFrontBack(card)
    return { cardId: card.id, front, back }
  })
  return (
    <>
      <p>
        A prompt appears on an asteroid field — blast the rock carrying its match before the asteroid hits. A wrong pick
        or a miss costs a life; you've got three. Clear every card or run out of lives, whichever comes first.
      </p>
      <BlastSession key={setId} setId={setId} pairs={pairs} />
    </>
  )
}
