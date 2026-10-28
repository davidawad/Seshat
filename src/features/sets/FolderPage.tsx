import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { StatsPanel } from '../stats/StatsPanel'
import { scopeToSets } from '../stats/scope'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import { folderIdSchema, setIdSchema } from '../../types'
import { SetsBrowser } from './SetsBrowser'
import '../../pages/stats.css'
import './folders.css'

/**
 * A folder is just a set list: the same browser as `/sets` (cards or table, search, study and edit links),
 * scoped to the folder's sets, with its own management controls and combined stats underneath.
 */
export const FolderPage = () => {
  const { id } = useParams<{ id: string }>()
  const { state, renameFolder, deleteFolder, setFolderMembership } = useSeshatStore()
  const navigate = useNavigate()
  const now = useMemo(() => new Date(), [])
  const [pick, setPick] = useState('')

  const parsed = folderIdSchema.safeParse(id ?? '')
  const folder = parsed.success ? state.folders.find((candidate) => candidate.id === parsed.data) : undefined
  const members = useMemo(() => new Set<string>(folder?.setIds ?? []), [folder])
  const scope = useMemo(() => scopeToSets(state, members), [state, members])

  if (folder === undefined) {
    return (
      <section aria-labelledby="folder-heading">
        <h1 id="folder-heading">Folder not found</h1>
        <p>
          <Link to="/sets">Back to sets</Link>
        </p>
      </section>
    )
  }

  const addable = state.sets.filter((set) => !members.has(set.id))
  const handleRename = () => {
    const next = window.prompt('Rename folder', folder.name)?.trim()
    if (next) renameFolder(folder.id, next)
  }
  const handleDelete = () => {
    if (!window.confirm(`Delete the folder "${folder.name}"? Its sets are kept.`)) return
    deleteFolder(folder.id)
    navigate('/sets')
  }
  const handleAdd = () => {
    const setId = setIdSchema.safeParse(pick)
    if (!setId.success) return
    setFolderMembership(folder.id, setId.data, true)
    setPick('')
  }

  return (
    <div data-testid={TESTIDS.folderPage}>
      <SetsBrowser title={folder.name} folder={folder}>
        <div className="folder-tools">
          <button type="button" className="secondary-link" onClick={handleRename} data-testid={TESTIDS.folderRename}>
            Rename folder
          </button>
          <button type="button" className="secondary-link" onClick={handleDelete} data-testid={TESTIDS.folderDelete}>
            Delete folder
          </button>
        </div>

        <div className="folder-add">
          <label htmlFor="folder-add-set">Add a set</label>
          <select
            id="folder-add-set"
            value={pick}
            onChange={(event) => setPick(event.target.value)}
            data-testid={TESTIDS.folderAddSet}
            disabled={addable.length === 0}
          >
            <option value="">{addable.length === 0 ? 'Every set is already here' : 'Choose a set…'}</option>
            {addable.map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
          </select>
          <button type="button" className="folder-add-button" onClick={handleAdd} disabled={pick === ''}>
            Add to folder
          </button>
        </div>

        <h2>Folder stats</h2>
        <StatsPanel scope={scope} now={now} idPrefix="folder-stats" />
      </SetsBrowser>
    </div>
  )
}
