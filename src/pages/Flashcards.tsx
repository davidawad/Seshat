import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { z } from 'zod'
import { FlashcardSession } from '../features/flashcards/FlashcardSession'
import {
  type FlashcardOrder,
  type FlashcardSessionState,
  advanceSession,
  createFlashcardSession,
  currentCardId,
  isSessionComplete,
} from '../features/flashcards/session'
import { matchesBinding } from '../lib/keybindings'
import { clearResumeState, loadResumeState, saveResumeState } from '../lib/sessionResume'
import { useSeshatStore } from '../lib/store'
import { useKeybindings } from '../lib/useKeybindings'
import { type CardId, type SetId, cardIdSchema, setIdSchema } from '../types'
import './flashcards-page.css'

const RESUME_MODE = 'flashcards'

const flashcardResumeSchema = z.object({
  order: z.array(cardIdSchema),
  position: z.number().int().nonnegative(),
  knownIds: z.array(cardIdSchema),
  unknownIds: z.array(cardIdSchema),
  orderMode: z.enum(['shuffled', 'original']),
})

const NotFound = ({ message }: { readonly message: string }) => (
  <section aria-labelledby="flashcards-heading">
    <h1 id="flashcards-heading">Flashcards</h1>
    <p>{message}</p>
    <p>
      <Link to="/sets">Back to sets</Link>
    </p>
  </section>
)

interface FlashcardCompleteProps {
  readonly session: FlashcardSessionState
  readonly onRestudyUnknown: () => void
  readonly onRestartFull: () => void
}

const FlashcardComplete = ({ session, onRestudyUnknown, onRestartFull }: FlashcardCompleteProps) => (
  <div className="illuminated-panel flashcard-complete" role="status">
    <h2 className="flashcard-complete-heading">Session complete</h2>
    <p>
      {session.order.length} card{session.order.length === 1 ? '' : 's'} — {session.knownIds.length} known,{' '}
      {session.unknownIds.length} to review again.
    </p>
    <div className="flashcard-complete-actions">
      {session.unknownIds.length > 0 && (
        <button type="button" onClick={onRestudyUnknown} autoFocus>
          Restudy {session.unknownIds.length} unknown card{session.unknownIds.length === 1 ? '' : 's'}
        </button>
      )}
      <button type="button" onClick={onRestartFull}>
        Restart full deck
      </button>
    </div>
  </div>
)

interface FlashcardRunnerProps {
  readonly setId: SetId
  readonly setName: string
  readonly cardIds: readonly CardId[]
}

/**
 * Owns the session's order, position, and known/unknown ids. The order is
 * fixed once at mount (via the lazy `useState` initializer) so recording a
 * review — which updates that card's FSRS scheduling in the store — never
 * reshuffles or resizes the running session. Changing the shuffle/order
 * toggle or restarting deliberately replaces the whole session rather than
 * reordering in place, same as Quizlet's own "shuffle" control.
 */
const FlashcardRunner = ({ setId, setName, cardIds }: FlashcardRunnerProps) => {
  const { state } = useSeshatStore()
  const { key: keyFor } = useKeybindings()
  const resumed = useMemo(() => loadResumeState(RESUME_MODE, setId, flashcardResumeSchema), [setId])
  const [orderMode, setOrderMode] = useState<FlashcardOrder>(resumed?.orderMode ?? 'shuffled')
  const [session, setSession] = useState<FlashcardSessionState>(
    () => resumed ?? createFlashcardSession(cardIds, orderMode),
  )

  const persistOrClear = (next: FlashcardSessionState, order: FlashcardOrder) => {
    if (isSessionComplete(next)) {
      clearResumeState(RESUME_MODE, setId)
    } else {
      saveResumeState(RESUME_MODE, setId, { ...next, orderMode: order })
    }
  }

  const handleAdvance = (known: boolean) => {
    const next = advanceSession(session, known)
    setSession(next)
    persistOrClear(next, orderMode)
  }

  const restart = (ids: readonly CardId[], order: FlashcardOrder) => {
    setSession(createFlashcardSession(ids, order))
    clearResumeState(RESUME_MODE, setId)
  }

  const setOrderAndRestart = (order: FlashcardOrder) => {
    setOrderMode(order)
    restart(cardIds, order)
  }

  // Toggles shuffled/original order — restarting the session is a deliberate
  // choice already made by the click-driven toggle above; the shortcut just
  // reaches the same action. Skipped while a text input is focused, matching
  // every other keyboard handler in the app.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (!matchesBinding(keyFor('flashcards.toggleOrder'), event)) return
      setOrderAndRestart(orderMode === 'shuffled' ? 'original' : 'shuffled')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [keyFor, orderMode, cardIds])

  const currentId = currentCardId(session)
  const card = currentId === null ? undefined : state.cards.find((candidate) => candidate.id === currentId)
  const complete = isSessionComplete(session) || card === undefined

  return (
    <section aria-labelledby="flashcards-heading">
      <p>
        <Link to={`/sets/${setId}`}>Back to {setName}</Link>
      </p>
      <h1 id="flashcards-heading">Flashcards: {setName}</h1>

      <fieldset className="flashcard-order-toggle">
        <legend className="sr-only">Card order</legend>
        <button
          type="button"
          aria-pressed={orderMode === 'shuffled'}
          className={orderMode === 'shuffled' ? 'is-active' : ''}
          onClick={() => setOrderAndRestart('shuffled')}
        >
          Shuffled
        </button>
        <button
          type="button"
          aria-pressed={orderMode === 'original'}
          className={orderMode === 'original' ? 'is-active' : ''}
          onClick={() => setOrderAndRestart('original')}
        >
          Original order
        </button>
      </fieldset>

      {complete ? (
        <FlashcardComplete
          session={session}
          onRestudyUnknown={() => restart(session.unknownIds, orderMode)}
          onRestartFull={() => restart(cardIds, orderMode)}
        />
      ) : (
        card !== undefined && (
          <FlashcardSession
            card={card}
            position={session.position}
            total={session.order.length}
            onAdvance={handleAdvance}
          />
        )
      )}
    </section>
  )
}

export const FlashcardsPage = () => {
  const { id } = useParams<{ id: string }>()
  const { state } = useSeshatStore()

  const parsedId = setIdSchema.safeParse(id ?? '')
  if (!parsedId.success) return <NotFound message="This link doesn't point to a valid set." />

  const setId = parsedId.data
  const set = state.sets.find((candidate) => candidate.id === setId)
  if (set === undefined) return <NotFound message="This set may have been deleted." />

  const cards = state.cards.filter((candidate) => candidate.setId === setId)
  if (cards.length === 0) {
    return (
      <section aria-labelledby="flashcards-heading">
        <p>
          <Link to={`/sets/${setId}`}>Back to {set.name}</Link>
        </p>
        <h1 id="flashcards-heading">Flashcards: {set.name}</h1>
        <p>This set has no cards yet. Add some from the set page first.</p>
      </section>
    )
  }

  return <FlashcardRunner key={setId} setId={setId} setName={set.name} cardIds={cards.map((card) => card.id)} />
}
