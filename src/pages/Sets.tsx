import { Route, Routes } from 'react-router-dom'
import { SetDetailPage } from '../features/sets/SetDetail'
import { SetEditPage } from '../features/sets/SetEdit'
import { SetListPage } from '../features/sets/SetList'
import { FlashcardsPage } from './Flashcards'
import { GameSessionPage, GamesListPage } from './Games'
import { StudyPage } from './Study'
import { TestPage } from './Test'

/**
 * Everything about sets, RESTfully nested under one router: `/sets` lists
 * and manages them; `/sets/:id` is a set's hub page; `/sets/:id/edit` is
 * where cards actually get added/edited; the study modes and the
 * (experimental, settings-gated) Games section each get their own
 * sub-route scoped to that one set.
 */
export const SetsPage = () => (
  <Routes>
    <Route index element={<SetListPage />} />
    <Route path=":id" element={<SetDetailPage />} />
    <Route path=":id/edit" element={<SetEditPage />} />
    <Route path=":id/study" element={<StudyPage />} />
    <Route path=":id/flashcards" element={<FlashcardsPage />} />
    <Route path=":id/test" element={<TestPage />} />
    <Route path=":id/games" element={<GamesListPage />} />
    <Route path=":id/games/:gameId" element={<GameSessionPage />} />
  </Routes>
)
