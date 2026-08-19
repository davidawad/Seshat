import licenseText from '../../public/LICENSE?raw'
import './license-page.css'

/**
 * Renders the actual `LICENSE` file text in-app (via Vite's `?raw` import —
 * one source of truth, not a hand-copied duplicate) so it's a real page
 * with the same header/footer chrome as everything else, instead of only
 * being reachable as a bare static file with no app UI around it. The
 * static `/LICENSE` file itself still exists too (`public/LICENSE`,
 * mirrored at the repo root) — that's the conventional location tooling
 * and other repos look for, this page is the in-app reading experience.
 */
export const LicensePage = () => (
  <section aria-labelledby="license-heading">
    <h1 id="license-heading">License</h1>
    <p>Seshat is licensed under the GNU General Public License v3 (or, at your option, any later version).</p>
    <pre className="license-text">{licenseText}</pre>
  </section>
)
