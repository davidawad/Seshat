import type { ComponentType } from 'react'
import type { SetId, StudyCard } from '../../types'

/**
 * Every game's session component gets the same three things and figures
 * out its own internal shape from `cards` (pairs, prompts, whatever) —
 * mirrors how Match mode already derives its `MatchPair[]` from raw cards.
 * Games are ungraded practice, not a study mode: none of them call
 * `recordReview`/touch FSRS scheduling, the same way the existing Match
 * mode never has.
 */
export interface GameSessionProps {
  readonly setId: SetId
  readonly setName: string
  readonly cards: readonly StudyCard[]
}

export interface GameDefinition {
  readonly id: string
  readonly label: string
  readonly description: string
  /** Below this card count the game can't build a round; the games list/session pages show a "need more cards" message instead of mounting it. */
  readonly minCards: number
  readonly Component: ComponentType<GameSessionProps>
}
