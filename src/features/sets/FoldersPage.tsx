import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { folderSetIds, scopeToSets, summarizeScope } from '../stats/scope'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import './folders-page.css'

/** `/folders`: every folder as a panel (sets, due, new), plus a one-line form to start another. */
export const FoldersPage = () => {
  const { state, addFolder } = useSeshatStore()
  const [name, setName] = useState('')
  const now = useMemo(() => new Date(), [])

  const folders = useMemo(
    () =>
      state.folders.map((folder) => ({
        folder,
        summary: summarizeScope(scopeToSets(state, folderSetIds(folder)), now),
      })),
    [state, now],
  )

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim().length === 0) return
    addFolder(name)
    setName('')
  }

  return (
    <section aria-labelledby="folders-heading" data-testid={TESTIDS.foldersPage}>
      <h1 id="folders-heading">Folders</h1>
      <p className="folders-lede">Group related sets, study them together and see their stats as one.</p>

      <form className="folders-new" onSubmit={handleSubmit} data-testid={TESTIDS.folderNewForm}>
        <label htmlFor="folders-new-name" className="folders-caption">
          New folder
        </label>
        <div className="folders-new-row">
          <input
            id="folders-new-name"
            type="text"
            placeholder="e.g. Organic chemistry"
            value={name}
            onChange={(event) => setName(event.target.value)}
            data-testid={TESTIDS.folderNewInput}
          />
          <button type="submit" disabled={name.trim().length === 0}>
            Create folder
          </button>
        </div>
      </form>

      {folders.length === 0 ? (
        <p className="folders-empty">
          No folders yet. Create one above, or add a whole topic from <Link to="/sets/browse">Browse</Link>.
        </p>
      ) : (
        <ul className="folders-grid">
          {folders.map(({ folder, summary }) => (
            <li key={folder.id}>
              <Link to={`/sets/folders/${folder.id}`} className="folders-panel" data-testid={TESTIDS.folderCard}>
                <span className="folders-caption">Folder</span>
                <span className="folders-panel-name">{folder.name}</span>
                <span className="folders-panel-meta">
                  {folder.setIds.length} set{folder.setIds.length === 1 ? '' : 's'} · {summary.cardCount} cards
                </span>
                <span className="folders-panel-stats">
                  <span className={summary.due > 0 ? 'folders-pill is-due' : 'folders-pill'}>{summary.due} due</span>
                  <span className="folders-pill">{summary.newCount} new</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
