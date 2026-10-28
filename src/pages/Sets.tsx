import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { FlashcardsPage } from './Flashcards'
import { StudyPage } from './Study'
import { SetsBrowser } from '../features/sets/SetsBrowser'
import { SetDetailPage } from '../features/sets/SetDetail'
import { FolderPage } from '../features/sets/FolderPage'
import { SetStatsPage } from '../features/stats/SetStatsPage'

// Editors, importers and the test mode load on demand so their CSS/JS stay out of the entry bundle.
const SetEditPage = lazy(async () => ({ default: (await import('../features/sets/SetEdit')).SetEditPage }))
const SetCreatePage = lazy(async () => ({ default: (await import('../features/sets/SetCreatePage')).SetCreatePage }))
const SetImportPage = lazy(async () => ({ default: (await import('../features/sets/SetImportPage')).SetImportPage }))
const SetBrowsePage = lazy(async () => ({ default: (await import('../features/sets/SetBrowsePage')).SetBrowsePage }))
const TestPage = lazy(async () => ({ default: (await import('./Test')).TestPage }))
const LearnPage = lazy(async () => ({ default: (await import('./Learn')).LearnPage }))

// The Games section is experimental and rarely visited: its CSS/JS load on demand.
const GamesListPage = lazy(async () => ({ default: (await import('./Games')).GamesListPage }))
const GameSessionPage = lazy(async () => ({ default: (await import('./Games')).GameSessionPage }))

/**
 * Everything about sets, RESTfully nested under one router: `/sets` is the same
 * sets browser as Home (only the heading differs); `/sets/:id` is a set's hub page; `/sets/:id/edit` is
 * where cards actually get added/edited; `/sets/new`, `/sets/import` and `/sets/browse` (the bundled catalog) are
 * full-page create and import flows (static paths win over `:id`); the study modes and the
 * (experimental, settings-gated) Games section each get their own
 * sub-route scoped to that one set.
 */
export const SetsPage = () => (
  <Suspense fallback={null}>
    <Routes>
      <Route index element={<SetsBrowser title="Sets" />} />
      <Route path="new" element={<SetCreatePage />} />
      <Route path="import" element={<SetImportPage />} />
      <Route path="browse" element={<SetBrowsePage />} />
      <Route path="folders/:id" element={<FolderPage />} />
      <Route path=":id" element={<SetDetailPage />} />
      <Route path=":id/edit" element={<SetEditPage />} />
      <Route path=":id/stats" element={<SetStatsPage />} />
      <Route path=":id/study" element={<StudyPage />} />
      <Route path=":id/flashcards" element={<FlashcardsPage />} />
      <Route path=":id/test" element={<TestPage />} />
      <Route path=":id/learn" element={<LearnPage />} />
      <Route path=":id/games" element={<GamesListPage />} />
      <Route path=":id/games/:gameId" element={<GameSessionPage />} />
    </Routes>
  </Suspense>
)
