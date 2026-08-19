import { MatchSession } from '../../match/MatchSession'
import type { MatchPair } from '../../match/round'
import { cardFrontBack } from '../../study/card-summary'
import type { GameSessionProps } from '../types'

export const MatchGame = ({ setId, cards }: GameSessionProps) => {
  const pairs: MatchPair[] = cards.map((card) => {
    const { front, back } = cardFrontBack(card)
    return { cardId: card.id, front, back }
  })
  return (
    <>
      <p>Pick a term and its matching definition. Timing starts on your first pick — no penalty for a miss.</p>
      <MatchSession key={setId} setId={setId} pairs={pairs} />
    </>
  )
}
