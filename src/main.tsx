import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App.tsx'
import { SeshatProvider } from './lib/store.tsx'
import { seshatWindowApi } from './lib/window-api.ts'
import './index.css'

const rootElement = document.getElementById('root')
if (rootElement === null) throw new Error('#root element not found')

window.seshat = seshatWindowApi
console.info(
  'Seshat exposes a scripting API at window.seshat — try window.seshat.listSets(). No backend involved; it reads/writes the same localStorage the app does. See README.md.',
)

// Registered production-only: in dev, a cached service worker would fight
// Vite's own HMR/module graph. Path is relative to BASE_URL (not a
// hardcoded '/sw.js') because GitLab Pages serves this app under
// /seshsat/, not the domain root — see vite.config.ts's `base`.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch(() => {
        // Offline caching is a progressive enhancement — a failed registration
        // (e.g. unsupported browser, blocked by an extension) shouldn't block
        // the app from working.
      })
  })
}

createRoot(rootElement).render(
  <StrictMode>
    <SeshatProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </SeshatProvider>
  </StrictMode>,
)
