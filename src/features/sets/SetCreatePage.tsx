import { type KeyboardEvent, useCallback, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import { CardRowEditor } from './CardRowEditor'
import { DescriptionField, TagsField, TitleField } from './CreateFields'
import { type DraftProblems, draftToExportedSet } from './set-draft'
import { useSetDraft } from './useSetDraft'
import './set-create.css'

const NO_PROBLEMS: DraftProblems = { titleMissing: false, incompleteRows: [], noCards: false }

/**
 * `/sets/new` — a full-page, Quizlet-style editor: title, description, tags
 * and a list of numbered term/definition rows. Creating dispatches ONE
 * `importSet` (the set and all its cards in a single state update, hence a
 * single undo-able unit). Work in progress lives in a localStorage draft
 * (see `set-draft.ts`) instead of a leave-page confirm: nothing is ever lost,
 * so there is nothing to ask about.
 */
export const SetCreatePage = () => {
  const { importSet } = useSeshatStore()
  const navigate = useNavigate()
  const { draft, restored, saved, setField, setRow, addRow, deleteRow, discard } = useSetDraft()
  const [attempted, setAttempted] = useState(false)
  const [focusRowId, setFocusRowId] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const clearFocusRow = useCallback(() => setFocusRowId(null), [])
  const appendRow = () => setFocusRowId(addRow())

  const create = (thenPractice: boolean) => {
    const result = draftToExportedSet(draft)
    setAttempted(true)
    if (!result.ok) {
      if (result.error.titleMissing) titleRef.current?.focus()
      return
    }
    const set = importSet(result.value)
    discard()
    navigate(thenPractice ? `/sets/${set.id}/study` : `/sets/${set.id}`)
  }

  // Re-evaluate on every render once the user has tried to create, so warnings clear as they fix things.
  const live = attempted ? draftToExportedSet(draft) : null
  const shown = live === null ? NO_PROBLEMS : live.ok ? NO_PROBLEMS : live.error

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      create(false)
    }
  }

  return (
    <section aria-labelledby="create-heading" data-testid={TESTIDS.createPage} className="set-create">
      <p className="page-back">
        <Link to="/sets" data-testid={TESTIDS.createBack}>
          Back
        </Link>
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          create(false)
        }}
        onKeyDown={handleKeyDown}
      >
        <header className="set-create-header">
          <h1 id="create-heading">Create a new set</h1>
          <div className="set-create-actions">
            <button type="submit" data-testid={TESTIDS.createSubmit}>
              Create
            </button>
            <button
              type="button"
              className="primary-button"
              data-testid={TESTIDS.createSubmitPractice}
              onClick={() => create(true)}
            >
              Create and practice
            </button>
          </div>
        </header>

        <p role="status" className="set-create-status" data-testid={TESTIDS.createDraftStatus}>
          {saved ? (restored ? 'Draft restored and saved' : 'Draft saved') : ''}
        </p>

        <TitleField
          value={draft.title}
          missing={shown.titleMissing}
          inputRef={titleRef}
          onChange={(value) => setField('title', value)}
        />
        <DescriptionField value={draft.description} onChange={(value) => setField('description', value)} />
        <TagsField value={draft.tags} onChange={(value) => setField('tags', value)} />

        <ol className="card-editor-list" aria-label="Cards" data-testid={TESTIDS.createCardList}>
          {draft.rows.map((row, index) => (
            <CardRowEditor
              key={row.id}
              row={row}
              number={index + 1}
              isLast={index === draft.rows.length - 1}
              canDelete={draft.rows.length > 1}
              incomplete={shown.incompleteRows.includes(index + 1)}
              focusTerm={focusRowId === row.id}
              onFocused={clearFocusRow}
              onChange={(patch) => setRow(row.id, patch)}
              onDelete={() => deleteRow(row.id)}
              onTabPastEnd={appendRow}
            />
          ))}
        </ol>

        {shown.noCards && (
          <p className="field-error" role="alert" data-testid={TESTIDS.createProblems}>
            Add at least one card with a term and a definition.
          </p>
        )}

        <div className="set-create-add">
          <button type="button" className="pill-button" data-testid={TESTIDS.createAddCard} onClick={appendRow}>
            Add a card
          </button>
        </div>
      </form>
    </section>
  )
}
