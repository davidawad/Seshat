import { Link, useParams } from 'react-router-dom'
import { DownloadIcon, EditIcon } from '../../components/icons'
import { useSeshatStore } from '../../lib/store'
import { setIdSchema } from '../../types'
import { downloadJson, slugify } from './download'
import './sets.css'
import { toSimpleJson } from './simple-json'
import { SetPreviewCard } from './SetPreviewCard'

const MODES = [
  { to: 'study', label: 'Study', hint: 'Recommended — recall-first, spaced by FSRS' },
  { to: 'flashcards', label: 'Flashcards', hint: 'Flip through the whole set' },
  { to: 'test', label: 'Test', hint: 'A generated practice test, scored at the end' },
  { to: 'match', label: 'Match', hint: 'A timed matching drill' },
] as const

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

  const parsedId = setIdSchema.safeParse(id ?? '')

  if (!parsedId.success) {
    return (
      <section aria-labelledby="set-not-found-heading">
        <h1 id="set-not-found-heading">Set not found</h1>
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
      <section aria-labelledby="set-not-found-heading">
        <h1 id="set-not-found-heading">Set not found</h1>
        <p>This set may have been deleted.</p>
        <p>
          <Link to="/sets">Back to sets</Link>
        </p>
      </section>
    )
  }

  const cards = state.cards.filter((card) => card.setId === setId)

  // One icon, one click — pick the format that preserves the most fidelity
  // for what's actually in the set, rather than asking the user to choose.
  const handleExport = () => {
    const hasRichContent = cards.some((card) => card.content.kind !== 'short-answer')
    if (hasRichContent) {
      const exported = exportSet(setId)
      if (exported !== null) downloadJson(`${slugify(set.name)}.seshat.json`, exported)
    } else {
      downloadJson(`${slugify(set.name)}.json`, toSimpleJson(set.name, cards))
    }
  }

  return (
    <section aria-labelledby="set-detail-heading" className="set-detail">
      <p>
        <Link to="/sets">Back to sets</Link>
      </p>

      <div className="set-detail-header">
        <div>
          <h1 id="set-detail-heading">{set.name}</h1>
          {set.description.length > 0 && <p>{set.description}</p>}
          {set.tags.length > 0 && (
            <ul aria-label="Tags" className="tag-chips">
              {set.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="set-detail-actions">
          <Link to={`/sets/${setId}/edit`} className="icon-button" aria-label={`Edit ${set.name}`}>
            <EditIcon />
          </Link>
          <button
            type="button"
            className="icon-button"
            onClick={handleExport}
            disabled={cards.length === 0}
            aria-label={`Export ${set.name}`}
          >
            <DownloadIcon />
          </button>
        </div>
      </div>

      {cards.length === 0 ? (
        <p>
          This set has no cards yet. <Link to={`/sets/${setId}/edit`}>Add some</Link> to start studying.
        </p>
      ) : (
        <>
          <nav aria-label="Study modes" className="mode-grid">
            {MODES.map((mode) => (
              <Link key={mode.to} to={`/sets/${setId}/${mode.to}`} className="mode-button">
                <span className="mode-button-label">{mode.label}</span>
                <span className="mode-button-hint">{mode.hint}</span>
              </Link>
            ))}
          </nav>

          <SetPreviewCard cards={cards} />
        </>
      )}
    </section>
  )
}
