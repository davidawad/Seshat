import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/Home'
import { SetsPage } from './pages/Sets'

// Rarely-visited pages load on demand so their CSS and JS stay out of the entry bundle.
const lazyPage = (load: () => Promise<Record<string, React.ComponentType>>, name: string) =>
  lazy(async () => ({ default: (await load())[name]! }))
const AboutPage = lazyPage(() => import('./pages/About'), 'AboutPage')
const AttributionsPage = lazyPage(() => import('./pages/Attributions'), 'AttributionsPage')
const DocsPage = lazyPage(() => import('./pages/Docs'), 'DocsPage')
const LicensePage = lazyPage(() => import('./pages/License'), 'LicensePage')
const ReleaseNotesPage = lazyPage(() => import('./pages/ReleaseNotes'), 'ReleaseNotesPage')
const StatsPage = lazyPage(() => import('./pages/Stats'), 'StatsPage')

// Settings lives as a modal (opened from the footer, see components/Layout.tsx)
// rather than its own route — there's nothing to deep-link to. Study is
// always scoped to a set (`/sets/:id/study`, see pages/Sets.tsx) — there's
// no standalone global study page.
export const App = () => (
  <Suspense fallback={null}>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="sets/*" element={<SetsPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="docs" element={<DocsPage />} />
        <Route path="releases" element={<ReleaseNotesPage />} />
        <Route path="attributions" element={<AttributionsPage />} />
        {/* Not "license" — collides with public/LICENSE on a case-insensitive
          filesystem (macOS/Windows), which serves the raw static file
          instead of falling through to this route. */}
        <Route path="licensing" element={<LicensePage />} />
      </Route>
    </Routes>
  </Suspense>
)
