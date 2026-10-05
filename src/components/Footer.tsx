import { Link } from 'react-router-dom'
import { TESTIDS } from '../lib/testids'

interface FooterProps {
  readonly onOpenSettings: () => void
  readonly onOpenShortcuts: () => void
}

/** The app-wide footer: a copyright notice on the left, reference/config links (About, Agents, Docs, Attributions, License) plus the Keyboard shortcuts and Settings buttons, styled as plain text links grouped on the right. */
export const Footer = ({ onOpenSettings, onOpenShortcuts }: FooterProps) => (
  <footer className="app-footer">
    <span className="app-footer-copyright">&copy; {new Date().getFullYear()} David Awad — free &amp; open source</span>
    <nav aria-label="Footer" className="app-footer-actions">
      <Link to="/about" className="app-footer-link" data-testid={TESTIDS.footerAbout}>
        About
      </Link>
      <a href={`${import.meta.env.BASE_URL}agents.txt`} className="app-footer-link" data-testid={TESTIDS.footerAgents}>
        Agents
      </a>
      <Link to="/docs" className="app-footer-link" data-testid={TESTIDS.footerDocs}>
        Docs
      </Link>
      <Link to="/attributions" className="app-footer-link" data-testid={TESTIDS.footerAttributions}>
        Attributions
      </Link>
      <Link to="/licensing" className="app-footer-link" data-testid={TESTIDS.footerLicense}>
        License
      </Link>
      <button
        type="button"
        className="app-footer-settings"
        data-testid={TESTIDS.shortcutsOpen}
        onClick={onOpenShortcuts}
      >
        Keyboard shortcuts
      </button>
      <button type="button" className="app-footer-settings" data-testid={TESTIDS.settingsOpen} onClick={onOpenSettings}>
        Settings
      </button>
    </nav>
  </footer>
)
