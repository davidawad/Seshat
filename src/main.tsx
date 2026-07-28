import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App.tsx'
import { SeshatProvider } from './lib/store.tsx'
import './index.css'

const rootElement = document.getElementById('root')
if (rootElement === null) throw new Error('#root element not found')

createRoot(rootElement).render(
  <StrictMode>
    <SeshatProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SeshatProvider>
  </StrictMode>,
)
