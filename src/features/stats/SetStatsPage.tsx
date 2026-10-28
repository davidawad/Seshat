import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import { setIdSchema } from '../../types'
import { useSetCrumbs } from '../sets/folder-trail'
import { StatsPanel } from './StatsPanel'
import { scopeToSets } from './scope'
import '../../pages/stats.css'

/** Stats for one set: the same numbers and calibration as the all-sets page, restricted to this set. */
export const SetStatsPage = () => {
  const { id } = useParams<{ id: string }>()
  const { state } = useSeshatStore()
  const now = useMemo(() => new Date(), [])
  const parsed = setIdSchema.safeParse(id ?? '')
  const set = parsed.success ? state.sets.find((candidate) => candidate.id === parsed.data) : undefined
  const { crumbs, trail } = useSetCrumbs(parsed.success ? parsed.data : null)
  const scope = useMemo(() => scopeToSets(state, new Set(set === undefined ? [] : [set.id])), [state, set])

  if (set === undefined) {
    return (
      <section aria-labelledby="set-stats-heading">
        <h1 id="set-stats-heading">Set not found</h1>
        <p>
          <Link to="/sets">Back to sets</Link>
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="set-stats-heading" data-testid={TESTIDS.setStatsPage}>
      <Breadcrumbs crumbs={[...crumbs, { label: set.name, to: `/sets/${set.id}`, state: trail }]} />
      <h1 id="set-stats-heading">{set.name}: stats</h1>
      <StatsPanel scope={scope} now={now} idPrefix="set-stats" />
    </section>
  )
}
