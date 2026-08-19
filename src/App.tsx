import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AttributionsPage } from './pages/Attributions'
import { DocsPage } from './pages/Docs'
import { HomePage } from './pages/Home'
import { LicensePage } from './pages/License'
import { SetsPage } from './pages/Sets'
import { StatsPage } from './pages/Stats'

// Settings lives as a modal (opened from the footer, see components/Layout.tsx)
// rather than its own route — there's nothing to deep-link to. Study is
// always scoped to a set (`/sets/:id/study`, see pages/Sets.tsx) — there's
// no standalone global study page.
export const App = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route index element={<HomePage />} />
      <Route path="sets/*" element={<SetsPage />} />
      <Route path="stats" element={<StatsPage />} />
      <Route path="docs" element={<DocsPage />} />
      <Route path="attributions" element={<AttributionsPage />} />
      {/* Not "license" — collides with public/LICENSE on a case-insensitive
          filesystem (macOS/Windows), which serves the raw static file
          instead of falling through to this route. */}
      <Route path="licensing" element={<LicensePage />} />
    </Route>
  </Routes>
)
