import { NavLink, Outlet } from 'react-router-dom'
import { useApplyTheme } from '../features/settings/theme'

const NAV_ITEMS = [
  { to: '/', label: 'Study', end: true },
  { to: '/decks', label: 'Decks', end: false },
  { to: '/stats', label: 'Stats', end: false },
  { to: '/settings', label: 'Settings', end: false },
  { to: '/docs', label: 'Docs', end: false },
  { to: '/attributions', label: 'Attributions', end: false },
] as const

export const Layout = () => {
  useApplyTheme()
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <span className="app-brand">Seshat</span>
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
    </div>
  )
}
