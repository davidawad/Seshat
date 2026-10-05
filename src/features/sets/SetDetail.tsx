import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DownloadIcon, EditIcon } from '../../components/icons'
import { useMediaStore } from '../../lib/media/MediaStoreProvider'
import { toJsonBlobWithMedia } from '../../lib/media/export'
import { collectMediaRefs } from '../../lib/media/refs'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import { OptionAnnouncer } from '../../lib/OptionAnnouncer'
import { useNumberedShortcut } from '../../lib/useNumberedShortcut'
import { NAV_OPTION_ATTRIBUTE, useOptionNavigation } from '../../lib/useOptionNavigation'
import { type AppState, type SetId, type StudyCard, setIdSchema } from '../../types'
import { downloadBlob, downloadJson, slugify } from './download'
import { SetMasterySummary } from './SetMasterySummary'
import './sets.css'
import { toSimpleJson } from './simple-json'
import { SetPreviewCard } from './SetPreviewCard'
import { SetTermList } from './SetTermList'

const START_MODE = {
  to: 'study',
  label: 'Start studying',
  hint: 'Recall-first, spaced by FSRS',
  testId: TESTIDS.setModeStudy,
} as const

const SECONDARY_MODES = [
  { to: 'flashcards', label: 'Flashcards', hint: 'Flip through the whole set', testId: TESTIDS.setModeFlashcards },
  { to: 'test', label: 'Test', hint: 'A generated practice test, scored at the end', testId: TESTIDS.setModeTest },
  {
    to: 'learn',
    label: 'Learn',
    hint: 'Short rounds: multiple choice, then typing',
    testId: TESTIDS.setModeLearn,
  },
] as const

const GAMES_MODE = {
  to: 'games',
  label: 'Games',
  hint: 'Experimental: Match, Blast, Blocks and the like',
  testId: TESTIDS.setModeGames,
} as const

/** The navigable modes in shortcut order: the primary one first, the secondary ones next. */
const NAV_MODES = [START_MODE, ...SECONDARY_MODES] as const

/** Resolves `setId` (already parsed, or `null` if the route param was invalid) to its set + cards. `undefined`/`[]` for a missing/invalid id, mirroring "not found" rather than throwing. */
const resolveSetContext = (state: AppState, setId: SetId | null) => {
  if (setId === null) return { set: undefined, cards: [] as StudyCard[] }
  const set = state.sets.find((candidate) => candidate.id === setId)
  const cards = state.cards.filter((card) => card.setId === setId)
  return { set, cards }
}

interface SetDetailHeaderProps {
  readonly setId: SetId
  readonly name: string
  readonly description: string
  readonly tags: readonly string[]
  readonly exportDisabled: boolean
  readonly onExport: () => void
}

/** Title, description, tags, and the edit/export actions — split out of `SetDetailPage` to keep that component's size/complexity in check. */
const SetDetailHeader = ({ setId, name, description, tags, exportDisabled, onExport }: SetDetailHeaderProps) => (
  <div className="set-detail-header">
    <div>
      <h1 id="set-detail-heading">{name}</h1>
      {description.length > 0 && <p>{description}</p>}
      {tags.length > 0 && (
        <ul aria-label="Tags" className="tag-chips">
          {tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
    </div>
    <div className="set-detail-actions">
      <Link
        to={`/sets/${setId}/edit`}
        className="icon-button"
        aria-label={`Edit ${name}`}
        data-testid={TESTIDS.setEditLink}
      >
        <EditIcon />
      </Link>
      <button
        type="button"
        className="icon-button"
        onClick={onExport}
        disabled={exportDisabled}
        aria-label={`Export ${name}`}
        data-testid={TESTIDS.setExport}
      >
        <DownloadIcon />
      </button>
    </div>
  </div>
)

/**
 * The hub for one set — the page you land on after opening it. Mode
 * buttons, a random-card preview, and icon-only edit/export actions. This
 * is deliberately NOT where cards get added or edited (see SetEdit) — a
 * page you open every time you want to study shouldn't also be a card
 * management console.
 */
export const SetDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const { state, exportSet } = useSeshatStore()
  const media = useMediaStore()
  const navigate = useNavigate()

  const parsedId = setIdSchema.safeParse(id ?? '')
  const setId = parsedId.success ? parsedId.data : null
  const { set, cards } = resolveSetContext(state, setId)
  const showGames = state.settings.experimentalGamesEnabled
  // Number keys reach every mode (Games last); arrow keys only walk the three links that are always visible.
  const modes = useMemo(() => (showGames ? [...NAV_MODES, GAMES_MODE] : NAV_MODES), [showGames])

  // Jump straight to a mode by number (only once the set actually has cards
  // and mode buttons are on screen — see the `cards.length === 0` branch
  // below). `useNumberedShortcut` is called unconditionally (before the
  // not-found early returns) since hooks can't be conditional — it just
  // no-ops until `active` is true. `set !== undefined` already implies
  // `setId !== null` (see `resolveSetContext`), so that's the only guard needed.
  useNumberedShortcut('setDetail.mode', modes.length, set !== undefined && cards.length > 0, (index) => {
    const mode = modes[index]
    if (setId !== null && mode !== undefined) navigate(`/sets/${setId}/${mode.to}`)
  })

  // Arrow-style keys move focus across the mode buttons; Enter on the
  // focused link activates it natively.
  const [highlight, setHighlight] = useState<number | null>(null)
  const modesRef = useRef<HTMLElement>(null)
  useOptionNavigation({
    count: NAV_MODES.length,
    index: highlight,
    onIndexChange: setHighlight,
    onConfirm: (index) => {
      const mode = NAV_MODES[index]
      if (setId !== null && mode !== undefined) navigate(`/sets/${setId}/${mode.to}`)
    },
    orientation: 'grid',
    enabled: set !== undefined && cards.length > 0,
    containerRef: modesRef,
  })

  if (setId === null) {
    return (
      <section aria-labelledby="set-not-found-heading">
        <h1 id="set-not-found-heading">Set not found</h1>
        <p>
          <Link to="/sets">Back to sets</Link>
        </p>
      </section>
    )
  }

  if (set === undefined) {
    return (
      <section aria-labelledby="set-not-found-heading">
        <h1 id="set-not-found-heading">Set not found</h1>
        <p>This set may have been deleted.</p>
        <p>
          <Link to="/sets">Back to sets</Link>
        </p>
      </section>
    )
  }

  // One icon, one click — pick the format that preserves the most fidelity
  // for what's actually in the set, rather than asking the user to choose.
  const handleExport = async () => {
    const hasRichContent = cards.some(
      (card) => card.content.kind !== 'short-answer' || card.promptImage !== null || card.content.answerImage !== null,
    )
    if (hasRichContent) {
      const exported = exportSet(setId)
      if (exported === null) return
      // Images travel inside the file (base64 `media`), built from Blob parts rather than one giant string.
      const { value } = await toJsonBlobWithMedia(exported, media, collectMediaRefs(exported.cards))
      downloadBlob(`${slugify(set.name)}.seshat.json`, value)
    } else {
      downloadJson(`${slugify(set.name)}.json`, toSimpleJson(set.name, cards))
    }
  }

  return (
    <section aria-labelledby="set-detail-heading" className="set-detail" data-testid={TESTIDS.setPage}>
      <p>
        <Link to="/sets">Back to sets</Link>
      </p>

      <SetDetailHeader
        setId={setId}
        name={set.name}
        description={set.description}
        tags={set.tags}
        exportDisabled={cards.length === 0}
        onExport={() => {
          void handleExport()
        }}
      />

      {cards.length === 0 ? (
        <p>
          This set has no cards yet. <Link to={`/sets/${setId}/edit`}>Add some</Link> to start studying.
        </p>
      ) : (
        <>
          <SetMasterySummary cards={cards} />

          <nav ref={modesRef} aria-label="Study modes" className="mode-nav">
            <Link
              to={`/sets/${setId}/${START_MODE.to}`}
              className="primary-link mode-start"
              data-testid={START_MODE.testId}
              onFocus={() => setHighlight(0)}
              {...{ [NAV_OPTION_ATTRIBUTE]: '' }}
            >
              {START_MODE.label}
            </Link>
            <p className="mode-start-hint">{START_MODE.hint}</p>
            <div className="mode-secondary">
              {SECONDARY_MODES.map((mode, index) => (
                <Link
                  key={mode.to}
                  to={`/sets/${setId}/${mode.to}`}
                  className="mode-button"
                  data-testid={mode.testId}
                  onFocus={() => setHighlight(index + 1)}
                  {...{ [NAV_OPTION_ATTRIBUTE]: '' }}
                >
                  <span className="mode-button-label">{mode.label}</span>
                  <span className="mode-button-hint">{mode.hint}</span>
                </Link>
              ))}
            </div>
          </nav>
          <OptionAnnouncer index={highlight} labels={NAV_MODES.map((mode) => mode.label)} />
          {showGames && (
            <details className="mode-more">
              <summary>More</summary>
              <Link to={`/sets/${setId}/${GAMES_MODE.to}`} className="mode-button" data-testid={GAMES_MODE.testId}>
                <span className="mode-button-label">{GAMES_MODE.label}</span>
                <span className="mode-button-hint">{GAMES_MODE.hint}</span>
              </Link>
            </details>
          )}

          <SetPreviewCard cards={cards} />

          <h2 className="set-term-list-heading">Terms in this set</h2>
          <SetTermList cards={cards} />
        </>
      )}
    </section>
  )
}
