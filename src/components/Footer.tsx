import { Link } from 'react-router-dom'

interface FooterProps {
  readonly onOpenSettings: () => void
}

/** The app-wide footer: a copyright notice on the left, reference/config links (Docs, Attributions, License, Settings) grouped on the right. */
export const Footer = ({ onOpenSettings }: FooterProps) => (
  <footer className="app-footer">
    <span className="app-footer-copyright">&copy; {new Date().getFullYear()} David Awad — free &amp; open source</span>
    <div className="app-footer-actions">
      <Link to="/docs" className="app-footer-link">
        Docs
      </Link>
      <Link to="/attributions" className="app-footer-link">
        Attributions
      </Link>
      <Link to="/licensing" className="app-footer-link">
        License
      </Link>
      <button type="button" className="app-footer-settings" onClick={onOpenSettings}>
        Settings
      </button>
    </div>
  </footer>
)
