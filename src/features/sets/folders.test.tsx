import { act, cleanup, render, renderHook, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyBackup, createBackup, parseBackup } from '../../lib/backup'
import { SeshatProvider, useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import { createEmptyAppState, type ExportedSet, type FolderId } from '../../types'
import { SetStatsPage } from '../stats/SetStatsPage'
import { FolderPage } from './FolderPage'
import { SetDetailPage } from './SetDetail'
import { SetsBrowser } from './SetsBrowser'

afterEach(() => cleanup())
beforeEach(() => window.localStorage.clear())

const makeSet = (name: string, cards: number): ExportedSet => ({
  seshatExportVersion: 1,
  name,
  description: '',
  tags: [],
  cards: Array.from({ length: cards }, (_, i) => ({
    prompt: `${name} q${i}`,
    promptImage: null,
    content: { kind: 'short-answer' as const, answer: `a${i}`, acceptableAnswers: [], answerImage: null },
    explanation: null,
    sourceRef: null,
    tags: [],
  })),
})

const wrapperAt = (path: string) =>
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <SeshatProvider>
        <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
      </SeshatProvider>
    )
  }

describe('folder state', () => {
  it('adds, renames, fills and deletes folders; deleting a set drops it from its folders', () => {
    const { result } = renderHook(() => useSeshatStore(), { wrapper: wrapperAt('/') })
    let setA = result.current.state.sets[0]
    let folderId = result.current.state.sets[0]?.id as unknown as FolderId
    act(() => {
      setA = result.current.importSet(makeSet('A', 1))
      result.current.importSet(makeSet('B', 1))
      folderId = result.current.addFolder('  Exams ').id
    })
    const folder = () => result.current.state.folders.find((f) => f.id === folderId)
    expect(folder()?.name).toBe('Exams')

    act(() => result.current.setFolderMembership(folderId, setA!.id, true))
    act(() => result.current.setFolderMembership(folderId, setA!.id, true))
    expect(folder()?.setIds).toEqual([setA!.id])

    act(() => result.current.renameFolder(folderId, 'Finals'))
    expect(folder()?.name).toBe('Finals')

    act(() => result.current.deleteSet(setA!.id))
    expect(folder()?.setIds).toEqual([])

    act(() => result.current.deleteFolder(folderId))
    expect(folder()).toBeUndefined()
    expect(result.current.state.sets).toHaveLength(1)
  })
})

describe('folders in backups', () => {
  it('round-trips through a backup, and an older file without folders still parses', () => {
    const { result } = renderHook(() => useSeshatStore(), { wrapper: wrapperAt('/') })
    act(() => {
      const set = result.current.importSet(makeSet('A', 1))
      const folder = result.current.addFolder('F')
      result.current.setFolderMembership(folder.id, set.id, true)
    })
    const backup = createBackup(result.current.state, {}, new Date())
    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed.ok && parsed.value.folders).toHaveLength(1)

    const { folders: _omitted, ...legacy } = backup
    const old = parseBackup(JSON.stringify(legacy))
    expect(old.ok && old.value.folders).toEqual([])

    const merged = applyBackup(createEmptyAppState(), backup, 'merge').state
    expect(merged.folders[0]?.setIds).toHaveLength(1)
  })

  it('rejects a folder that lists a set the backup lacks', () => {
    const { result } = renderHook(() => useSeshatStore(), { wrapper: wrapperAt('/') })
    act(() => {
      const set = result.current.importSet(makeSet('A', 1))
      const folder = result.current.addFolder('F')
      result.current.setFolderMembership(folder.id, set.id, true)
    })
    const backup = createBackup(result.current.state, {}, new Date())
    const broken = { ...backup, sets: [], cards: [], reviewLog: [] }
    expect(parseBackup(JSON.stringify(broken)).ok).toBe(false)
  })
})

describe('folder and per-set pages', () => {
  const seed = () => {
    const { result } = renderHook(() => useSeshatStore(), { wrapper: wrapperAt('/') })
    act(() => {
      const a = result.current.importSet(makeSet('Alpha', 2))
      result.current.importSet(makeSet('Beta', 2))
      const folder = result.current.addFolder('Group')
      result.current.setFolderMembership(folder.id, a.id, true)
    })
    act(() => {
      const card = result.current.state.cards.find((c) => c.setId === result.current.state.sets[0]!.id)!
      result.current.recordReview(card.id, 'good', 'sure', true, 1000)
    })
    const { state } = result.current
    return { state, setA: state.sets[0]!, folder: state.folders[0]! }
  }

  it('creates a folder from the sets page', async () => {
    const user = userEvent.setup()
    const { result } = renderHook(() => useSeshatStore(), { wrapper: wrapperAt('/') })
    act(() => void result.current.importSet(makeSet('Alpha', 1)))
    cleanup()
    render(<SetsBrowser title="Sets" />, { wrapper: wrapperAt('/sets') })
    await user.type(screen.getByTestId(TESTIDS.folderNewInput), 'Biology')
    await user.click(screen.getByRole('button', { name: 'New folder' }))
    expect(screen.getByTestId(TESTIDS.folderCard)).toHaveTextContent('Biology')
    expect(screen.getByTestId(TESTIDS.folderCard)).toHaveTextContent('0 sets')
  })

  it('shows stats for only the sets in the folder', () => {
    const { folder } = seed()
    cleanup()
    render(
      <Routes>
        <Route path="/sets/folders/:id" element={<FolderPage />} />
      </Routes>,
      { wrapper: wrapperAt(`/sets/folders/${folder.id}`) },
    )
    const page = screen.getByTestId(TESTIDS.folderPage)
    const list = within(page).getByTestId(TESTIDS.setsBrowserGrid)
    expect(within(list).getByText('Alpha')).toBeInTheDocument()
    expect(within(list).queryByText('Beta')).not.toBeInTheDocument()
    expect(within(page).getByText('Reviewed today').nextSibling).toHaveTextContent('1')
  })

  it('removes a set from the folder with the row button and offers it again in the add list', async () => {
    const user = userEvent.setup()
    const { folder } = seed()
    cleanup()
    render(
      <Routes>
        <Route path="/sets/folders/:id" element={<FolderPage />} />
      </Routes>,
      { wrapper: wrapperAt(`/sets/folders/${folder.id}`) },
    )
    await user.click(screen.getByRole('button', { name: 'Remove Alpha from this folder' }))
    expect(screen.getByText(/No sets in this folder yet/)).toBeInTheDocument()
    const add = screen.getByTestId(TESTIDS.folderAddSet)
    expect(within(add).getByRole('option', { name: 'Alpha' })).toBeInTheDocument()
  })

  it('shows stats for one set only', () => {
    const { setA } = seed()
    cleanup()
    render(
      <Routes>
        <Route path="/sets/:id/stats" element={<SetStatsPage />} />
      </Routes>,
      { wrapper: wrapperAt(`/sets/${setA.id}/stats`) },
    )
    const page = screen.getByTestId(TESTIDS.setStatsPage)
    expect(page).toHaveTextContent('Alpha: stats')
    expect(within(page).getByText('Reviewed today').nextSibling).toHaveTextContent('1')
    expect(within(page).getByText('New cards').nextSibling).toHaveTextContent('1')
  })

  it('shows the folder in the set breadcrumbs only when navigated from that folder', () => {
    const { setA, folder } = seed()
    cleanup()
    const routes = (
      <Routes>
        <Route path="/sets/:id" element={<SetDetailPage />} />
      </Routes>
    )
    const at = (entry: string | { pathname: string; state: unknown }) =>
      function Wrapper({ children }: { readonly children: ReactNode }) {
        return (
          <SeshatProvider>
            <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
          </SeshatProvider>
        )
      }

    render(routes, { wrapper: at({ pathname: `/sets/${setA.id}`, state: { fromFolder: folder.id } }) })
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(trail).getByRole('link', { name: 'Group' })).toHaveAttribute('href', `/sets/folders/${folder.id}`)
    cleanup()

    render(routes, { wrapper: at(`/sets/${setA.id}`) })
    const direct = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(direct).queryByRole('link', { name: 'Group' })).not.toBeInTheDocument()
    expect(within(direct).getByRole('link', { name: 'Sets' })).toBeInTheDocument()
  })
})
