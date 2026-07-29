import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ReviewSession } from '../features/study/ReviewSession'
import { countDueCategories, selectDueQueue } from '../features/study/dueQueue'
import { useSeshatStore } from '../lib/store'
import { type SetId, setIdSchema } from '../types'

/**
 * Advances past a card that vanished from the store mid-session (e.g.
 * deleted from another tab). Never renders anything itself.
 */
const SkipRemovedCard = ({ onSkip }: { readonly onSkip: () => void }) => {
  useEffect(() => onSkip(), [onSkip])
  return null
}

interface StudyQueueProps {
  readonly setId: SetId
}

const StudyQueue = ({ setId }: StudyQueueProps) => {
  const { state } = useSeshatStore()

  // The due queue is snapshotted once per session (keyed by setId in the
  // parent) rather than recomputed on every card update — recording a
  // review changes that card's scheduling, and we don't want the queue
  // reshuffling or a card vanishing mid-review just because its own answer
  // was just graded.
  const dueIds = useMemo(() => selectDueQueue(state.cards, setId, new Date()), [setId]) // eslint-disable-line react-hooks/exhaustive-deps
  const [position, setPosition] = useState(0)

  const cardsInScope = useMemo(() => state.cards.filter((card) => card.setId === setId), [state.cards, setId])

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
    return (
      <p role="status">
        Session complete — {dueIds.length} card{dueIds.length === 1 ? '' : 's'} reviewed.
      </p>
    )
  }

  const card = state.cards.find((candidate) => candidate.id === currentId)
  if (card === undefined) {
    return <SkipRemovedCard onSkip={() => setPosition((p) => p + 1)} />
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
        onAdvance={() => setPosition((p) => p + 1)}
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
