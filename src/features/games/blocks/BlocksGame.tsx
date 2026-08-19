import { BlocksSession } from './BlocksSession'
import type { GameSessionProps } from '../types'

export const BlocksGame = ({ setId, cards }: GameSessionProps) => {
  return (
    <>
      <p>
        Answer each question to earn a block piece, then drop it into a column. Complete a row or column to clear it for
        bonus points.
      </p>
      <BlocksSession key={setId} setId={setId} cards={cards} />
    </>
  )
}
