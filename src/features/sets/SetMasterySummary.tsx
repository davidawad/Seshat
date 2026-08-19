import { useMemo } from 'react'
import { summarizeMastery } from './set-summary'
import type { StudyCard } from '../../types'

interface SetMasterySummaryProps {
  readonly cards: readonly StudyCard[]
}

/**
 * A one-line "where do things stand" readout above the mode picker —
 * Quizlet's set page shows a progress/mastery signal in the same spot.
 * Read-only rollup of each card's existing FSRS scheduling; doesn't
 * compute anything new.
 */
export const SetMasterySummary = ({ cards }: SetMasterySummaryProps) => {
  const summary = useMemo(() => summarizeMastery(cards, new Date()), [cards])

  const parts = [`${summary.total} card${summary.total === 1 ? '' : 's'}`]
  if (summary.due > 0) parts.push(`${summary.due} due for review`)
  if (summary.newCount > 0) parts.push(`${summary.newCount} new`)
  if (summary.lastStudied !== null) parts.push(`last studied ${summary.lastStudied.toLocaleDateString()}`)

  return (
    <p className="set-mastery-summary" role="status">
      {parts.join(' · ')}
    </p>
  )
}
