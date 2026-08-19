import { useEffect, useId, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { ImportFromUrl } from '../features/sets/ImportFromUrl'
import { SettingsForm } from '../features/settings/SettingsForm'
import { useApplyTheme } from '../features/settings/theme'
import { matchesBinding } from '../lib/keybindings'
import { useKeybindings } from '../lib/useKeybindings'
import { Footer } from './Footer'
import { SetsIcon, StatsIcon } from './icons'
import { Modal } from './Modal'

// Docs/Attributions/License all live in the footer (see Footer.tsx)
// alongside Settings, not up here — they're reference material you'd look
// up, not a mode you switch into like Sets/Stats, so they don't need equal
// billing in the primary nav or the thumb-reachable mobile tab bar.
const NAV_ITEMS = [
  { to: '/sets', label: 'Sets', end: false, icon: SetsIcon },
  { to: '/stats', label: 'Stats', end: false, icon: StatsIcon },
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
  const { key: keyFor } = useKeybindings()

  // Global "open settings" shortcut (default '?') — skipped while a text
  // input is focused or the modal is already open (Escape/the visible close
  // button already handle closing it, via the native <dialog>).
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat || settingsOpen) return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (!matchesBinding(keyFor('global.openSettings'), event)) return
      setSettingsOpen(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [settingsOpen, keyFor])

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
        <nav aria-label="Primary" className="app-nav-desktop">
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
      <ImportFromUrl />
      <main id="main-content" className="app-main">
        <Outlet />
      </main>
      <Footer onOpenSettings={() => setSettingsOpen(true)} />
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} titleId={settingsTitleId} title="Settings">
        <SettingsForm />
      </Modal>
      {/* Bottom tab bar — the mobile replacement for .app-nav-desktop below
          the 640px breakpoint (see index.css). Same NAV_ITEMS/routes, just
          a thumb-reachable fixed layout instead of a header row that has no
          room to fit four labelled links on a phone width. */}
      <nav aria-label="Primary" className="app-tabbar">
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end}>
                <item.icon />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
