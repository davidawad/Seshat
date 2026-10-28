import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import './folders.css'

/** Folders strip on the sets page: one tile per folder (name, set count) and an inline "New folder" form. */
export const FoldersSection = () => {
  const { state, addFolder } = useSeshatStore()
  const [name, setName] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim().length === 0) return
    addFolder(name)
    setName('')
  }

  return (
    <section aria-labelledby="folders-heading" className="folders-section" data-testid={TESTIDS.foldersSection}>
      <h2 id="folders-heading">Folders</h2>
      {state.folders.length > 0 && (
        <ul className="folder-grid">
          {state.folders.map((folder) => (
            <li key={folder.id}>
              <Link to={`/sets/folders/${folder.id}`} className="folder-card" data-testid={TESTIDS.folderCard}>
                <span className="folder-card-name">{folder.name}</span>
                <span className="folder-card-count">
                  {folder.setIds.length} set{folder.setIds.length === 1 ? '' : 's'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <form className="folder-new" onSubmit={handleSubmit} data-testid={TESTIDS.folderNewForm}>
        <input
          type="text"
          aria-label="New folder name"
          placeholder="New folder name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          data-testid={TESTIDS.folderNewInput}
        />
        <button type="submit" className="secondary-link" disabled={name.trim().length === 0}>
          New folder
        </button>
      </form>
    </section>
  )
}
