import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { z } from 'zod'
import { ReviewSession } from '../features/study/ReviewSession'
import { countDueCategories, reinsertForRelearning, selectDueQueue } from '../features/study/dueQueue'
import { GRADE_ORDER } from '../features/study/grading'
import { clearResumeState, loadResumeState, saveResumeState } from '../lib/sessionResume'
import { useSeshatStore } from '../lib/store'
import { type CardId, type Grade, type SetId, type StudyCard, cardIdSchema, setIdSchema } from '../types'
import './study.css'

const RESUME_MODE = 'study'

const studyResumeSchema = z.object({
  dueIds: z.array(cardIdSchema),
  position: z.number().int().nonnegative(),
  stats: z.object({
    reviewed: z.number().int().nonnegative(),
    correct: z.number().int().nonnegative(),
    gradeCounts: z.object({
      again: z.number().int().nonnegative(),
      hard: z.number().int().nonnegative(),
      good: z.number().int().nonnegative(),
      easy: z.number().int().nonnegative(),
    }),
  }),
  elapsedMsAtSave: z.number().nonnegative(),
})

interface SessionStats {
  readonly reviewed: number
  readonly correct: number
  readonly gradeCounts: Readonly<Record<Grade, number>>
}

const EMPTY_STATS: SessionStats = { reviewed: 0, correct: 0, gradeCounts: { again: 0, hard: 0, good: 0, easy: 0 } }

const GRADE_LABEL: Readonly<Record<Grade, string>> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' }

interface SessionSummaryProps {
  readonly stats: SessionStats
  readonly elapsedMs: number
}

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

const SessionSummary = ({ stats, elapsedMs }: SessionSummaryProps) => {
  const accuracy = stats.reviewed === 0 ? 0 : Math.round((stats.correct / stats.reviewed) * 100)
  return (
    <div className="illuminated-panel session-summary" role="status">
      <h2 className="session-summary-heading">Session complete</h2>
      <dl className="session-summary-stats">
        <div>
          <dt>Cards reviewed</dt>
          <dd>{stats.reviewed}</dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>{accuracy}%</dd>
        </div>
        <div>
          <dt>Time spent</dt>
          <dd>{formatDuration(elapsedMs)}</dd>
        </div>
      </dl>
      <ul className="session-summary-grades">
        {GRADE_ORDER.map((grade) => (
          <li key={grade}>
            <span className="session-summary-grade-label">{GRADE_LABEL[grade]}</span>
            <span className="session-summary-grade-count">{stats.gradeCounts[grade]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Advances past a card that vanished from the store mid-session (e.g.
 * deleted from another tab). Never renders anything itself.
 */
const SkipRemovedCard = ({ onSkip }: { readonly onSkip: () => void }) => {
  useEffect(() => onSkip(), [onSkip])
  return null
}

interface StudySessionState {
  readonly dueIds: readonly CardId[]
  readonly position: number
  readonly stats: SessionStats
  readonly elapsedMsAtSave: number
}

/**
 * Resumed session state (if any) is read once at mount, keyed by setId —
 * `StudyQueue` remounts (`key={setId}` in the parent) on set change, so a
 * fresh mount is exactly the right time to check for a session someone
 * closed mid-way.
 */
const initialStudyState = (setId: SetId, cards: readonly StudyCard[]): StudySessionState => {
  const resumed = loadResumeState(RESUME_MODE, setId, studyResumeSchema)
  if (resumed !== null) return resumed
  return { dueIds: selectDueQueue(cards, setId, new Date()), position: 0, stats: EMPTY_STATS, elapsedMsAtSave: 0 }
}

const tallyGrade = (stats: SessionStats, grade: Grade, correct: boolean): SessionStats => ({
  reviewed: stats.reviewed + 1,
  correct: stats.correct + (correct ? 1 : 0),
  gradeCounts: { ...stats.gradeCounts, [grade]: stats.gradeCounts[grade] + 1 },
})

const persistStudyProgress = (setId: SetId, session: StudySessionState): void => {
  if (session.position >= session.dueIds.length) {
    clearResumeState(RESUME_MODE, setId)
    return
  }
  saveResumeState(RESUME_MODE, setId, session)
}

interface StudyQueueProps {
  readonly setId: SetId
}

const StudyQueue = ({ setId }: StudyQueueProps) => {
  const { state } = useSeshatStore()

  // The due queue is snapshotted once per session (keyed by setId in the
  // parent) rather than recomputed from `state.cards` on every update —
  // recording a review changes that card's scheduling, and we don't want
  // the queue reshuffling or a card vanishing mid-review just because its
  // own answer was just graded. It's still `useState`, not `useMemo`: an
  // "again" grade mutates it (see handleAdvance below) to reinsert the
  // lapsed card a few cards later in this same session.
  const [session, setSession] = useState<StudySessionState>(() => initialStudyState(setId, state.cards))
  const sessionStart = useRef(performance.now() - session.elapsedMsAtSave)
  const { dueIds, position, stats } = session

  const cardsInScope = useMemo(() => state.cards.filter((card) => card.setId === setId), [state.cards, setId])

  const handleAdvance = (grade: Grade, correct: boolean, cardId: CardId) => {
    const nextDueIds = grade === 'again' ? reinsertForRelearning(dueIds, position, cardId) : dueIds
    const next: StudySessionState = {
      dueIds: nextDueIds,
      position: position + 1,
      stats: tallyGrade(stats, grade, correct),
      elapsedMsAtSave: performance.now() - sessionStart.current,
    }
    setSession(next)
    persistStudyProgress(setId, next)
  }

  const handleSkip = () => {
    const next: StudySessionState = {
      ...session,
      position: position + 1,
      elapsedMsAtSave: performance.now() - sessionStart.current,
    }
    setSession(next)
    persistStudyProgress(setId, next)
  }

  if (dueIds.length === 0) {
    const later = cardsInScope.length
    return (
      <p role="status">
        Nothing due right now — {later} card{later === 1 ? '' : 's'} scheduled for later.
      </p>
    )
  }

  const currentId = dueIds[position]
  if (currentId === undefined) {
    return <SessionSummary stats={stats} elapsedMs={performance.now() - sessionStart.current} />
  }

  const card = state.cards.find((candidate) => candidate.id === currentId)
  if (card === undefined) {
    return <SkipRemovedCard onSkip={handleSkip} />
  }

  // Only worth mentioning at session start, and only when there's actually
  // more than one topic due — a single-category queue has nothing to
  // interleave against (see interleaveByCategory).
  const showInterleaveNote = position === 0 && countDueCategories(state.cards, dueIds) > 1

  return (
    <>
      {showInterleaveNote && <p>Cards are interleaved across topics to sharpen discrimination between them.</p>}
      <ReviewSession
        card={card}
        position={position}
        total={dueIds.length}
        onAdvance={(grade, correct) => handleAdvance(grade, correct, currentId)}
      />
    </>
  )
}

/** Mounted at `/sets/:id/study` — the recall-first, FSRS-scheduled default mode, scoped to one set. */
export const StudyPage = () => {
  const { id } = useParams<{ id: string }>()
  const { state } = useSeshatStore()

  const parsedId = setIdSchema.safeParse(id ?? '')
  if (!parsedId.success) {
    return (
      <section aria-labelledby="study-heading">
        <h1 id="study-heading">Set not found</h1>
        <p>
          <Link to="/sets">Back to sets</Link>
        </p>
      </section>
    )
  }

  const setId = parsedId.data
  const set = state.sets.find((candidate) => candidate.id === setId)
  if (set === undefined) {
    return (
      <section aria-labelledby="study-heading">
        <h1 id="study-heading">Set not found</h1>
        <p>This set may have been deleted.</p>
        <p>
          <Link to="/sets">Back to sets</Link>
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="study-heading">
      <p>
        <Link to={`/sets/${setId}`}>Back to {set.name}</Link>
      </p>
      <h1 id="study-heading">Study: {set.name}</h1>
      {/* Remounts the queue whenever the set changes, resetting session state cleanly. */}
      <StudyQueue key={setId} setId={setId} />
    </section>
  )
}
