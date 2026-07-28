import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
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
  readonly setId: SetId | null
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

  const cardsInScope = useMemo(
    () => state.cards.filter((card) => setId === null || card.setId === setId),
    [state.cards, setId],
  )

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

/**
 * Mounted at two routes: `/study` (global — every due card across every
 * set) and `/sets/:id/study` (scoped to one set). `id` is simply absent
 * on the first, so both are the same component.
 */
export const StudyPage = () => {
  const { id } = useParams<{ id?: string }>()
  const { state } = useSeshatStore()

  const setId = useMemo<SetId | null>(() => {
    if (id === undefined) return null
    const parsed = setIdSchema.safeParse(id)
    return parsed.success ? parsed.data : null
  }, [id])

  const set = useMemo(
    () => (setId === null ? null : (state.sets.find((candidate) => candidate.id === setId) ?? null)),
    [setId, state.sets],
  )

  return (
    <section aria-labelledby="study-heading">
      <h1 id="study-heading">{set !== null ? `Study: ${set.name}` : 'Study'}</h1>
      {/* Remounts the queue whenever the set filter changes, resetting session state cleanly. */}
      <StudyQueue key={setId ?? 'all'} setId={setId} />
    </section>
  )
}
