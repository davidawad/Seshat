import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AttributionsPage } from './pages/Attributions'
import { DocsPage } from './pages/Docs'
import { HomePage } from './pages/Home'
import { SetsPage } from './pages/Sets'
import { StatsPage } from './pages/Stats'
import { StudyPage } from './pages/Study'

// Settings lives as a modal (opened from the footer, see components/Layout.tsx)
// rather than its own route — there's nothing to deep-link to.
export const App = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route index element={<HomePage />} />
      <Route path="study" element={<StudyPage />} />
      <Route path="sets/*" element={<SetsPage />} />
      <Route path="stats" element={<StatsPage />} />
      <Route path="docs" element={<DocsPage />} />
      <Route path="attributions" element={<AttributionsPage />} />
    </Route>
  </Routes>
)
