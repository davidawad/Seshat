import { useLocation } from 'react-router-dom'
import type { Crumb } from '../../components/Breadcrumbs'
import { useSeshatStore } from '../../lib/store'
import { type FolderId, type SetId, folderIdSchema } from '../../types'

/** Router navigation state set by links that lead into a set from a folder page. */
export interface FolderTrailState {
  readonly fromFolder: FolderId
}

export const folderTrail = (folderId: FolderId): FolderTrailState => ({ fromFolder: folderId })

/**
 * Breadcrumbs for a page under `/sets`: `Sets`, plus the folder the learner came from when they
 * clicked through from it (and the set is still in that folder). Opening the URL directly has no
 * navigation state, so it shows plain `Sets`.
 */
export const useSetCrumbs = (setId: SetId | null): { crumbs: Crumb[]; trail: FolderTrailState | undefined } => {
  const { state } = useSeshatStore()
  const location = useLocation()
  const raw: unknown = (location.state as { fromFolder?: unknown } | null)?.fromFolder
  const parsed = folderIdSchema.safeParse(raw)
  const folder =
    parsed.success && setId !== null
      ? state.folders.find((candidate) => candidate.id === parsed.data && candidate.setIds.includes(setId))
      : undefined
  const sets: Crumb = { label: 'Sets', to: '/sets' }
  return folder === undefined
    ? { crumbs: [sets], trail: undefined }
    : {
        crumbs: [
          { label: 'Folders', to: '/folders' },
          { label: folder.name, to: `/sets/folders/${folder.id}` },
        ],
        trail: folderTrail(folder.id),
      }
}
