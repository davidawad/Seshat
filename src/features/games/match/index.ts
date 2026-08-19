import { MatchGame } from './MatchGame'
import type { GameDefinition } from '../types'

/** Matching needs at least two pairs to be a game at all. */
const MIN_PAIRS = 2

export const matchGameDefinition: GameDefinition = {
  id: 'match',
  label: 'Match',
  description: 'Race the clock to pair every term with its definition.',
  minCards: MIN_PAIRS,
  Component: MatchGame,
}
