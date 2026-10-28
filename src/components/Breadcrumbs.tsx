import { Link } from 'react-router-dom'
import './breadcrumbs.css'

export interface Crumb {
  readonly label: string
  readonly to: string
  /** Router navigation state to pass along (keeps a "came from this folder" trail). */
  readonly state?: unknown
}

/** Clickable trail of the pages above this one. The current page is deliberately not listed: the title is right below. */
export const Breadcrumbs = ({ crumbs }: { readonly crumbs: readonly Crumb[] }) => (
  <nav aria-label="Breadcrumb" className="breadcrumbs">
    <ol>
      {crumbs.map((crumb) => (
        <li key={crumb.to}>
          <Link to={crumb.to} state={crumb.state} data-label={crumb.label}>
            {crumb.label}
          </Link>
        </li>
      ))}
    </ol>
  </nav>
)
