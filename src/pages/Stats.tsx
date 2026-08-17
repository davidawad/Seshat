import { useMemo } from 'react'
import {
  calibrationBuckets,
  dueBacklogCount,
  retentionEstimate,
  reviewedTodayCount,
} from '../features/stats/calibration'
import { useSeshatStore } from '../lib/store'
import type { ConfidenceRating } from '../types'

const CONFIDENCE_LABELS: Record<ConfidenceRating, string> = {
  guessed: 'Guessed',
  unsure: 'Unsure',
  sure: 'Sure',
}

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`

export const StatsPage = () => {
  const { state } = useSeshatStore()
  const now = useMemo(() => new Date(), [])

  const backlog = useMemo(() => dueBacklogCount(state.cards, now), [state.cards, now])
  const reviewedToday = useMemo(() => reviewedTodayCount(state.reviewLog, now), [state.reviewLog, now])
  const retention = useMemo(() => retentionEstimate(state.reviewLog), [state.reviewLog])
  const buckets = useMemo(() => calibrationBuckets(state.reviewLog), [state.reviewLog])

  return (
    <section aria-labelledby="stats-heading">
      <h1 id="stats-heading">Stats</h1>

      <dl className="stats-summary">
        <div className="stats-metric">
          <dt>Due now</dt>
          <dd>{backlog}</dd>
        </div>
        <div className="stats-metric">
          <dt>Reviewed today</dt>
          <dd>{reviewedToday}</dd>
        </div>
        <div className="stats-metric">
          <dt>Estimated retention</dt>
          <dd>{retention === null ? 'Not enough data yet' : formatPercent(retention)}</dd>
        </div>
      </dl>

      <h2 id="calibration-heading">Confidence calibration</h2>
      <p>
        A well-calibrated learner&rsquo;s confidence tracks how often they&rsquo;re actually right. If
        &ldquo;Sure&rdquo; answers come back correct less often than &ldquo;Guessed&rdquo; ones, that&rsquo;s
        overconfidence — the fluency illusion at work, not a knowledge problem.
      </p>
      <div className="table-scroll">
        <table aria-labelledby="calibration-heading">
          <thead>
            <tr>
              <th scope="col">Confidence</th>
              <th scope="col">Reviews</th>
              <th scope="col">Actual correct rate</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.confidence}>
                <th scope="row">{CONFIDENCE_LABELS[bucket.confidence]}</th>
                <td>{bucket.total}</td>
                <td>{bucket.correctRate === null ? '—' : formatPercent(bucket.correctRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
