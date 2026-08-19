import { BlastGame } from './BlastGame'
import type { GameDefinition } from '../types'
import { MIN_CARDS } from './round'

export const blastGameDefinition: GameDefinition = {
  id: 'blast',
  label: 'Blast',
  description: 'Blast the asteroid carrying the right match before it hits.',
  minCards: MIN_CARDS,
  Component: BlastGame,
}
