import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ReviewSession } from '../features/study/ReviewSession'
import { countDueCategories, selectDueQueue } from '../features/study/dueQueue'
import { useSeshatStore } from '../lib/store'
import { type DeckId, deckIdSchema } from '../types'

/**
 * Advances past a card that vanished from the store mid-session (e.g.
 * deleted from another tab). Never renders anything itself.
 */
const SkipRemovedCard = ({ onSkip }: { readonly onSkip: () => void }) => {
  useEffect(() => onSkip(), [onSkip])
  return null
}

interface StudyQueueProps {
  readonly deckId: DeckId | null
}

const StudyQueue = ({ deckId }: StudyQueueProps) => {
  const { state } = useSeshatStore()

  // The due queue is snapshotted once per session (keyed by deckId in the
  // parent) rather than recomputed on every card update — recording a
  // review changes that card's scheduling, and we don't want the queue
  // reshuffling or a card vanishing mid-review just because its own answer
  // was just graded.
  const dueIds = useMemo(() => selectDueQueue(state.cards, deckId, new Date()), [deckId]) // eslint-disable-line react-hooks/exhaustive-deps
  const [position, setPosition] = useState(0)

  const cardsInScope = useMemo(
    () => state.cards.filter((card) => deckId === null || card.deckId === deckId),
    [state.cards, deckId],
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

export const StudyPage = () => {
  const { state } = useSeshatStore()
  const [searchParams] = useSearchParams()
  const deckParam = searchParams.get('deck')

  const deckId = useMemo<DeckId | null>(() => {
    if (deckParam === null) return null
    const parsed = deckIdSchema.safeParse(deckParam)
    return parsed.success ? parsed.data : null
  }, [deckParam])

  const deck = useMemo(
    () => (deckId === null ? null : (state.decks.find((candidate) => candidate.id === deckId) ?? null)),
    [deckId, state.decks],
  )

  return (
    <section aria-labelledby="study-heading">
      <h1 id="study-heading">{deck !== null ? `Study: ${deck.name}` : 'Study'}</h1>
      {/* Remounts the queue whenever the deck filter changes, resetting session state cleanly. */}
      <StudyQueue key={deckId ?? 'all'} deckId={deckId} />
    </section>
  )
}
