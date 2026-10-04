import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { z } from 'zod'
import { FlashcardOptionsModal } from '../features/flashcards/FlashcardOptionsModal'
import { FlashcardSession } from '../features/flashcards/FlashcardSession'
import { gradeAnnouncement, resolveOptions, undoAnnouncement } from '../features/flashcards/options'
import {
  type FlashcardOrder,
  type FlashcardRun,
  type FlashcardSessionState,
  type GradeRecord,
  canUndo,
  createFlashcardRun,
  createFlashcardSession,
  currentCardId,
  gradeRun,
  isSessionComplete,
  undoRun,
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
  /** Present only while the last grade can still be taken back. */
  readonly onUndo: (() => void) | undefined
}

const FlashcardComplete = ({ session, onRestudyUnknown, onRestartFull, onUndo }: FlashcardCompleteProps) => (
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
      {onUndo !== undefined && (
        <button type="button" onClick={onUndo}>
          Undo last answer
        </button>
      )}
    </div>
  </div>
)

interface FlashcardRunnerProps {
  readonly setId: SetId
  readonly setName: string
  readonly cardIds: readonly CardId[]
}

const PageHeader = ({ setId, setName }: { readonly setId: SetId; readonly setName: string }) => (
  <div className="flashcards-header">
    <Link to={`/sets/${setId}`}>Back</Link>
    <h1 id="flashcards-heading">{setName}</h1>
  </div>
)

/**
 * Owns the run: the session's order/position/known/unknown ids plus the
 * undo stack (see `FlashcardRun`). The order is fixed once at mount (via the
 * lazy `useState` initializer) so recording a review — which updates that
 * card's FSRS scheduling in the store — never reshuffles or resizes the
 * running session. Changing the shuffle toggle or restarting deliberately
 * replaces the whole run rather than reordering in place, same as Quizlet's
 * own "shuffle" control. Only the session is persisted for resume; the undo
 * stack is in-memory, so a resumed session starts with nothing to undo.
 */
const FlashcardRunner = ({ setId, setName, cardIds }: FlashcardRunnerProps) => {
  const { state, undoReview, updateSettings } = useSeshatStore()
  const { key: keyFor } = useKeybindings()
  const options = resolveOptions(state.settings)
  const resumed = useMemo(() => loadResumeState(RESUME_MODE, setId, flashcardResumeSchema), [setId])
  const [orderMode, setOrderMode] = useState<FlashcardOrder>(resumed?.orderMode ?? 'shuffled')
  const [run, setRun] = useState<FlashcardRun>(() =>
    createFlashcardRun(resumed ?? createFlashcardSession(cardIds, orderMode)),
  )
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  // Bumped on every restart so the card remounts unflipped even when the new
  // run starts on the same card at the same position.
  const [runId, setRunId] = useState(0)
  const { session } = run

  const persistOrClear = (next: FlashcardSessionState, order: FlashcardOrder) => {
    if (isSessionComplete(next)) {
      clearResumeState(RESUME_MODE, setId)
    } else {
      saveResumeState(RESUME_MODE, setId, { ...next, orderMode: order })
    }
  }

  const handleGrade = (record: GradeRecord) => {
    const next = gradeRun(run, record)
    setRun(next)
    persistOrClear(next.session, orderMode)
    setAnnouncement(gradeAnnouncement(record.known, next.session.position, next.session.order.length))
  }

  // Steps back one card and, if that grade was tracked, rolls the card's FSRS
  // scheduling and its review-log entry back too.
  const handleUndo = () => {
    const { run: next, undone } = undoRun(run)
    if (undone === null) return
    if (undone.previousScheduling !== null && undone.reviewedAt !== null) {
      undoReview(undone.cardId, undone.previousScheduling, undone.reviewedAt)
    }
    setRun(next)
    persistOrClear(next.session, orderMode)
    setAnnouncement(undoAnnouncement(next.session.position, next.session.order.length))
  }

  const restart = (ids: readonly CardId[], order: FlashcardOrder) => {
    setRun(createFlashcardRun(createFlashcardSession(ids, order)))
    clearResumeState(RESUME_MODE, setId)
    setAnnouncement('')
    setRunId((id) => id + 1)
  }

  const setOrderAndRestart = (order: FlashcardOrder) => {
    setOrderMode(order)
    restart(cardIds, order)
  }

  const toggleOrder = () => setOrderAndRestart(orderMode === 'shuffled' ? 'original' : 'shuffled')

  // Order-toggle and undo shortcuts — restarting the session is a deliberate
  // choice already made by the click-driven toggle; the shortcut just reaches
  // the same action. Skipped while a text input is focused, matching every
  // other keyboard handler in the app, and while the Options modal is open.
  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (event.repeat) return
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
    if (matchesBinding(keyFor('flashcards.toggleOrder'), event)) toggleOrder()
    else if (matchesBinding(keyFor('flashcards.undo'), event)) handleUndo()
  })
  useEffect(() => {
    if (optionsOpen) return
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [optionsOpen])

  const currentId = currentCardId(session)
  const card = currentId === null ? undefined : state.cards.find((candidate) => candidate.id === currentId)
  const complete = isSessionComplete(session) || card === undefined

  return (
    <section aria-labelledby="flashcards-heading">
      <PageHeader setId={setId} setName={setName} />

      {complete ? (
        <FlashcardComplete
          session={session}
          onRestudyUnknown={() => restart(session.unknownIds, orderMode)}
          onRestartFull={() => restart(cardIds, orderMode)}
          onUndo={canUndo(run) ? handleUndo : undefined}
        />
      ) : (
        card !== undefined && (
          // Keyed per card shown so the flip state resets instantly instead of
          // animating the next card's answer into view while turning back.
          <FlashcardSession
            key={`${runId}:${session.position}`}
            card={card}
            position={session.position}
            total={session.order.length}
            options={options}
            shortcutsEnabled={!optionsOpen}
            onGrade={handleGrade}
            canUndo={canUndo(run)}
            shuffled={orderMode === 'shuffled'}
            onUndo={handleUndo}
            onToggleShuffle={toggleOrder}
            onOpenOptions={() => setOptionsOpen(true)}
          />
        )
      )}

      <p role="status" className="sr-only" data-testid="flashcards-announcer">
        {announcement}
      </p>

      <FlashcardOptionsModal
        open={optionsOpen}
        options={options}
        onClose={() => setOptionsOpen(false)}
        onTrackProgressChange={(flashcardsTrackProgress) => updateSettings({ flashcardsTrackProgress })}
        onFrontChange={(flashcardsFront) => updateSettings({ flashcardsFront })}
        onRestart={() => {
          restart(cardIds, orderMode)
          setOptionsOpen(false)
        }}
      />
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
        <PageHeader setId={setId} setName={set.name} />
        <p>This set has no cards yet. Add some from the set page first.</p>
      </section>
    )
  }

  return <FlashcardRunner key={setId} setId={setId} setName={set.name} cardIds={cards.map((card) => card.id)} />
}
