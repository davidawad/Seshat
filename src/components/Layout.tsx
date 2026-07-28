import { useId, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { SettingsForm } from '../features/settings/SettingsForm'
import { useApplyTheme } from '../features/settings/theme'
import { Footer } from './Footer'
import { Modal } from './Modal'

const NAV_ITEMS = [
  { to: '/study', label: 'Study', end: false },
  { to: '/sets', label: 'Sets', end: false },
  { to: '/stats', label: 'Stats', end: false },
  { to: '/docs', label: 'Docs', end: false },
  { to: '/attributions', label: 'Attributions', end: false },
] as const

// Seshat's own hieroglyphic emblem — a seven-pointed star on a stem, the
// same mark as public/favicon.svg — reused here as the header logomark.
const SeshatMark = () => (
  <svg className="app-brand-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <g fill="currentColor">
      <rect x="22.5" y="4" width="3" height="20" rx="1.5" transform="rotate(0 24 24)" />
      <rect x="22.5" y="4" width="3" height="20" rx="1.5" transform="rotate(51.4286 24 24)" />
      <rect x="22.5" y="4" width="3" height="20" rx="1.5" transform="rotate(102.8571 24 24)" />
      <rect x="22.5" y="4" width="3" height="20" rx="1.5" transform="rotate(154.2857 24 24)" />
      <rect x="22.5" y="4" width="3" height="20" rx="1.5" transform="rotate(205.7143 24 24)" />
      <rect x="22.5" y="4" width="3" height="20" rx="1.5" transform="rotate(257.1429 24 24)" />
      <rect x="22.5" y="4" width="3" height="20" rx="1.5" transform="rotate(308.5714 24 24)" />
      <circle cx="24" cy="24" r="4.5" />
    </g>
  </svg>
)

export const Layout = () => {
  useApplyTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsTitleId = useId()

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <Link to="/" className="app-brand">
          <SeshatMark />
          Seshat
        </Link>
        <nav aria-label="Primary">
          <ul className="app-nav">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main-content" className="app-main">
        <Outlet />
      </main>
      <Footer onOpenSettings={() => setSettingsOpen(true)} />
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} titleId={settingsTitleId} title="Settings">
        <SettingsForm />
      </Modal>
    </div>
  )
}
