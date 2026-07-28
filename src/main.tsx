import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App.tsx'
import { SeshatProvider } from './lib/store.tsx'
import './index.css'

const rootElement = document.getElementById('root')
if (rootElement === null) throw new Error('#root element not found')

// Registered production-only: in dev, a cached service worker would fight
// Vite's own HMR/module graph.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline caching is a progressive enhancement — a failed registration
      // (e.g. unsupported browser, blocked by an extension) shouldn't block
      // the app from working.
    })
  })
}

createRoot(rootElement).render(
  <StrictMode>
    <SeshatProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SeshatProvider>
  </StrictMode>,
)
