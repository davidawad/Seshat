import { Link } from 'react-router-dom'

interface FooterProps {
  readonly onOpenSettings: () => void
  readonly onOpenShortcuts: () => void
}

/** The app-wide footer: a copyright notice on the left, reference/config links (About, Agents, Docs, Attributions, License) plus the Keyboard shortcuts and Settings buttons grouped on the right. */
export const Footer = ({ onOpenSettings, onOpenShortcuts }: FooterProps) => (
  <footer className="app-footer">
    <span className="app-footer-copyright">&copy; {new Date().getFullYear()} David Awad — free &amp; open source</span>
    <div className="app-footer-actions">
      <Link to="/about" className="app-footer-link">
        About
      </Link>
      <a href={`${import.meta.env.BASE_URL}agents.txt`} className="app-footer-link">
        Agents
      </a>
      <Link to="/docs" className="app-footer-link">
        Docs
      </Link>
      <Link to="/attributions" className="app-footer-link">
        Attributions
      </Link>
      <Link to="/licensing" className="app-footer-link">
        License
      </Link>
      <button type="button" className="app-footer-settings" onClick={onOpenShortcuts}>
        Keyboard shortcuts
      </button>
      <button type="button" className="app-footer-settings" onClick={onOpenSettings}>
        Settings
      </button>
    </div>
  </footer>
)
