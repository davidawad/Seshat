import { useMemo } from 'react'
import { DataTable, dataTableHelper, sortableColumn as sortable } from '../components/DataTable'
import {
  calibrationBuckets,
  hasConfidenceData,
  dueBacklogCount,
  retentionEstimate,
  reviewedTodayCount,
} from '../features/stats/calibration'
import { formatDuration, timeToFirstGradedMs } from '../lib/activation'
import { useSeshatStore } from '../lib/store'
import { TESTIDS } from '../lib/testids'
import type { Activation, ConfidenceRating } from '../types'

const CONFIDENCE_LABELS: Record<ConfidenceRating, string> = {
  guessed: 'Guessed',
  unsure: 'Unsure',
  sure: 'Sure',
}

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`

type Bucket = ReturnType<typeof calibrationBuckets>[number]

const CONFIDENCE_ORDER: readonly ConfidenceRating[] = ['guessed', 'unsure', 'sure']

const helper = dataTableHelper<Bucket>()

const CALIBRATION_COLUMNS = helper.columns([
  helper.accessor((bucket) => CONFIDENCE_ORDER.indexOf(bucket.confidence), {
    id: 'confidence',
    header: 'Confidence',
    ...sortable,
    sortFn: 'basic',
    cell: ({ row }) => CONFIDENCE_LABELS[row.original.confidence],
  }),
  helper.accessor((bucket) => bucket.total, { id: 'reviews', header: 'Reviews', ...sortable, sortFn: 'basic' }),
  helper.accessor((bucket) => bucket.correctRate ?? -1, {
    id: 'correctRate',
    header: 'Actual correct rate',
    ...sortable,
    sortFn: 'basic',
    cell: ({ row }) => (row.original.correctRate === null ? '—' : formatPercent(row.original.correctRate)),
  }),
])

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

  const backlog = useMemo(() => dueBacklogCount(state.cards, now), [state.cards, now])
  const reviewedToday = useMemo(() => reviewedTodayCount(state.reviewLog, now), [state.reviewLog, now])
  const retention = useMemo(() => retentionEstimate(state.reviewLog), [state.reviewLog])
  const buckets = useMemo(() => calibrationBuckets(state.reviewLog), [state.reviewLog])
  const hasConfidence = useMemo(() => hasConfidenceData(state.reviewLog), [state.reviewLog])

  return (
    <section aria-labelledby="stats-heading" data-testid={TESTIDS.statsPage}>
      <h1 id="stats-heading">Stats</h1>

      <dl className="stats-summary" data-testid={TESTIDS.statsSummary}>
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

      <FirstWeek activation={state.activation} />

      <h2 id="calibration-heading">Confidence calibration</h2>
      <p>
        A well-calibrated learner&rsquo;s confidence tracks how often they&rsquo;re actually right. If
        &ldquo;Sure&rdquo; answers come back correct less often than &ldquo;Guessed&rdquo; ones, that&rsquo;s
        overconfidence — the fluency illusion at work, not a knowledge problem.
      </p>
      {!hasConfidence && (
        <p data-testid={TESTIDS.statsCalibrationEmpty}>
          No confidence ratings yet. Turn on the confidence prompt in Settings to see how well your confidence matches
          your results.
        </p>
      )}
      {hasConfidence && (
        <div className="table-scroll">
          <DataTable
            data={buckets}
            columns={CALIBRATION_COLUMNS}
            getRowId={(bucket) => bucket.confidence}
            caption="Confidence calibration"
            testId={TESTIDS.statsCalibrationTable}
            rowHeaderColumn="confidence"
          />
        </div>
      )}
    </section>
  )
}
