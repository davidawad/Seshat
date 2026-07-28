import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AttributionsPage } from './pages/Attributions'
import { DecksPage } from './pages/Decks'
import { DocsPage } from './pages/Docs'
import { SettingsPage } from './pages/Settings'
import { StatsPage } from './pages/Stats'
import { StudyPage } from './pages/Study'

export const App = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route index element={<StudyPage />} />
      <Route path="decks/*" element={<DecksPage />} />
      <Route path="stats" element={<StatsPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="docs" element={<DocsPage />} />
      <Route path="attributions" element={<AttributionsPage />} />
    </Route>
  </Routes>
)
