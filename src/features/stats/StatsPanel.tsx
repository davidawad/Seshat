import { useMemo } from 'react'
import { DataTable, dataTableHelper, sortableColumn as sortable } from '../../components/DataTable'
import { TESTIDS } from '../../lib/testids'
import type { ConfidenceRating } from '../../types'
import { calibrationBuckets, hasConfidenceData } from './calibration'
import { type StatsScope, formatPercent, summarizeScope } from './scope'

const CONFIDENCE_LABELS: Record<ConfidenceRating, string> = {
  guessed: 'Guessed',
  unsure: 'Unsure',
  sure: 'Sure',
}

const CONFIDENCE_ORDER: readonly ConfidenceRating[] = ['guessed', 'unsure', 'sure']

type Bucket = ReturnType<typeof calibrationBuckets>[number]

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

interface StatsPanelProps {
  readonly scope: StatsScope
  readonly now: Date
  /** Heading level-2 id prefix, so several panels on one page keep unique ids. */
  readonly idPrefix?: string
}

/** The headline numbers and the confidence-calibration table for any slice of the app (all sets, one set, a folder). */
export const StatsPanel = ({ scope, now, idPrefix = 'stats' }: StatsPanelProps) => {
  const summary = useMemo(() => summarizeScope(scope, now), [scope, now])
  const buckets = useMemo(() => calibrationBuckets(scope.reviewLog), [scope.reviewLog])
  const hasConfidence = useMemo(() => hasConfidenceData(scope.reviewLog), [scope.reviewLog])

  return (
    <>
      <dl className="stats-summary" data-testid={TESTIDS.statsSummary}>
        <div className="stats-metric">
          <dt>Due now</dt>
          <dd>{summary.due}</dd>
        </div>
        <div className="stats-metric">
          <dt>New cards</dt>
          <dd>{summary.newCount}</dd>
        </div>
        <div className="stats-metric">
          <dt>Reviewed today</dt>
          <dd>{summary.reviewedToday}</dd>
        </div>
        <div className="stats-metric">
          <dt>Correct rate</dt>
          <dd>{summary.correctRate === null ? '—' : formatPercent(summary.correctRate)}</dd>
        </div>
        <div className="stats-metric">
          <dt>Estimated retention</dt>
          <dd>{summary.retention === null ? 'Not enough data yet' : formatPercent(summary.retention)}</dd>
        </div>
      </dl>

      <h2 id={`${idPrefix}-calibration-heading`}>Confidence calibration</h2>
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
    </>
  )
}
