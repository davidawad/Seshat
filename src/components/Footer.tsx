interface FooterProps {
  readonly onOpenSettings: () => void
}

/** The app-wide footer — its one job is being the home for the Settings button. */
export const Footer = ({ onOpenSettings }: FooterProps) => (
  <footer className="app-footer">
    <span className="app-footer-brand">Seshat — free &amp; open source</span>
    <button type="button" className="app-footer-settings" onClick={onOpenSettings}>
      Settings
    </button>
  </footer>
)
