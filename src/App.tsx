import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AttributionsPage } from './pages/Attributions'
import { DocsPage } from './pages/Docs'
import { HomePage } from './pages/Home'
import { SettingsPage } from './pages/Settings'
import { SetsPage } from './pages/Sets'
import { StatsPage } from './pages/Stats'
import { StudyPage } from './pages/Study'

export const App = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route index element={<HomePage />} />
      <Route path="study" element={<StudyPage />} />
      <Route path="sets/*" element={<SetsPage />} />
      <Route path="stats" element={<StatsPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="docs" element={<DocsPage />} />
      <Route path="attributions" element={<AttributionsPage />} />
    </Route>
  </Routes>
)
