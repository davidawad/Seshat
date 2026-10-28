import { useMemo } from 'react'
import { ScopeBreakdown, type BreakdownRow } from '../features/stats/ScopeBreakdown'
import { StatsPanel } from '../features/stats/StatsPanel'
import { folderSetIds, scopeToSets, summarizeScope } from '../features/stats/scope'
import { formatDuration, timeToFirstGradedMs } from '../lib/activation'
import { useSeshatStore } from '../lib/store'
import { TESTIDS } from '../lib/testids'
import type { Activation } from '../types'
import './stats.css'

const FirstWeek = ({ activation }: { readonly activation: Activation }) => {
  const toFirstGraded = timeToFirstGradedMs(activation)
  return (
    <section aria-labelledby="first-week-heading" data-testid={TESTIDS.statsFirstWeek}>
      <h2 id="first-week-heading">Your first week</h2>
      <dl className="stats-summary">
        <div className="stats-metric">
          <dt>Time to first graded card</dt>
          <dd>{toFirstGraded === null ? 'Not yet' : formatDuration(toFirstGraded)}</dd>
        </div>
        <div className="stats-metric">
          <dt>Reviews so far</dt>
          <dd>{activation.totalReviews}</dd>
        </div>
        <div className="stats-metric">
          <dt>Days studied</dt>
          <dd>{activation.daysStudied}</dd>
        </div>
      </dl>
      <p>These numbers are counted on this device only. They are never sent anywhere.</p>
    </section>
  )
}

export const StatsPage = () => {
  const { state } = useSeshatStore()
  const now = useMemo(() => new Date(), [])
  const everything = useMemo(() => ({ cards: state.cards, reviewLog: state.reviewLog }), [state.cards, state.reviewLog])

  const setRows = useMemo<BreakdownRow[]>(
    () =>
      state.sets.map((set) => ({
        id: set.id,
        name: set.name,
        href: `/sets/${set.id}/stats`,
        summary: summarizeScope(scopeToSets(state, new Set([set.id])), now),
      })),
    [state, now],
  )
  const folderRows = useMemo<BreakdownRow[]>(
    () =>
      state.folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        href: `/sets/folders/${folder.id}`,
        summary: summarizeScope(scopeToSets(state, folderSetIds(folder)), now),
      })),
    [state, now],
  )

  return (
    <section aria-labelledby="stats-heading" data-testid={TESTIDS.statsPage}>
      <h1 id="stats-heading">Stats</h1>

      <StatsPanel scope={everything} now={now} />

      {setRows.length > 0 && (
        <>
          <h2 id="by-set-heading">By set</h2>
          <ScopeBreakdown rows={setRows} caption="Stats by set" testId={TESTIDS.statsBySet} />
        </>
      )}
      {folderRows.length > 0 && (
        <>
          <h2 id="by-folder-heading">By folder</h2>
          <ScopeBreakdown rows={folderRows} caption="Stats by folder" testId={TESTIDS.statsByFolder} />
        </>
      )}

      <FirstWeek activation={state.activation} />
    </section>
  )
}
