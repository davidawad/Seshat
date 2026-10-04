import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ImportFromUrl } from '../features/sets/ImportFromUrl'
import { isMacPlatform, paletteKeyHint } from '../features/palette/palette-items'
import { SettingsForm } from '../features/settings/SettingsForm'
import { useApplyTheme } from '../features/settings/theme'
import { formatKeyLabel, matchesBinding } from '../lib/keybindings'
import { useRouteFocus } from '../lib/routeFocus'
import { TESTIDS } from '../lib/testids'
import { useKeybindings } from '../lib/useKeybindings'
import { useWebMcp } from '../lib/useWebMcp'
import { Footer } from './Footer'
import { SetsIcon, StatsIcon } from './icons'
import { Modal } from './Modal'
import { SaveErrorBanner } from './SaveErrorBanner'
import { ShortcutsModal } from './ShortcutsModal'

// cmdk (and the Radix pieces it pulls in) only loads the first time the
// command menu is opened, so it stays out of the main bundle.
const CommandPalette = lazy(() =>
  import('../features/palette/CommandPalette').then((module) => ({ default: module.CommandPalette })),
)

// Docs/Attributions/License all live in the footer (see Footer.tsx)
// alongside Settings, not up here — they're reference material you'd look
// up, not a mode you switch into like Sets/Stats, so they don't need equal
// billing in the primary nav or the thumb-reachable mobile tab bar.
const NAV_ITEMS = [
  { to: '/sets', label: 'Sets', end: false, icon: SetsIcon, testId: TESTIDS.navSets },
  { to: '/stats', label: 'Stats', end: false, icon: StatsIcon, testId: TESTIDS.navStats },
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
  useWebMcp()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  // Stays false until the first open so the lazy chunk is never fetched for nothing.
  const [paletteWanted, setPaletteWanted] = useState(false)
  const settingsTitleId = useId()
  const shortcutsTitleId = useId()
  const { key: keyFor } = useKeybindings()
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  // After a route change, put focus on the new page's h1 (see lib/routeFocus.ts).
  useRouteFocus(pathname, mainRef)

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

  // Global command-menu shortcut (default Ctrl+K; matchesBinding also accepts
  // Cmd+K). Unlike '?', it works from inside text fields, and it toggles.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat || !matchesBinding(keyFor('global.openPalette'), event)) return
      event.preventDefault()
      setPaletteWanted(true)
      setPaletteOpen((open) => !open)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [keyFor])

  const openPalette = () => {
    setPaletteWanted(true)
    setPaletteOpen(true)
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <Link to="/" className="app-brand" data-testid={TESTIDS.navHome}>
          <SeshatMark />
          Seshat
        </Link>
        <nav aria-label="Primary" className="app-nav-desktop">
          <ul className="app-nav">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} data-testid={item.testId}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <SaveErrorBanner onOpenSettings={() => setSettingsOpen(true)} />
      <ImportFromUrl />
      <main id="main-content" ref={mainRef} className="app-main" data-testid={TESTIDS.layoutMain}>
        <Outlet />
      </main>
      <Footer
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onOpenPalette={openPalette}
        paletteKeyHint={paletteKeyHint(formatKeyLabel(keyFor('global.openPalette')), isMacPlatform())}
      />
      {/* Before the Settings/Shortcuts modals: when a palette action opens one, the
          palette must close (and restore focus) first. */}
      {paletteWanted && (
        <Suspense fallback={null}>
          <CommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenShortcuts={() => setShortcutsOpen(true)}
          />
        </Suspense>
      )}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        titleId={settingsTitleId}
        title="Settings"
        testId={TESTIDS.settingsModal}
        closeTestId={TESTIDS.settingsModalClose}
      >
        <SettingsForm />
      </Modal>
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} titleId={shortcutsTitleId} />
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
