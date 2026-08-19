import { BlocksGame } from './BlocksGame'
import { MIN_CARDS } from './round'
import type { GameDefinition } from '../types'

/**
 * Multiple-choice needs at least 3 *other* cards to source distinct decoys
 * for every question (see round.ts's `MIN_CARDS`), so a set needs at least
 * 4 cards total before Blocks can build a full round.
 */
export const blocksGameDefinition: GameDefinition = {
  id: 'blocks',
  label: 'Blocks',
  description: 'Answer questions to earn block pieces, then drop them to clear rows and columns for points.',
  minCards: MIN_CARDS,
  Component: BlocksGame,
}
