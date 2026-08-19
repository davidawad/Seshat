import { blastGameDefinition } from './blast'
import { blocksGameDefinition } from './blocks'
import { matchGameDefinition } from './match'
import type { GameDefinition } from './types'

/** The Games section's full roster — gated behind Settings.experimentalGamesEnabled as one cohort. */
export const GAMES: readonly GameDefinition[] = [matchGameDefinition, blastGameDefinition, blocksGameDefinition]
