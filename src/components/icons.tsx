/**
 * Minimal inline-SVG icon set — no icon library dependency for a handful
 * of glyphs. Each is a plain 20x20 stroke icon, `aria-hidden` since every
 * call site pairs it with a visible or `aria-label`'d text.
 */
const commonProps = {
  viewBox: '0 0 20 20',
  width: 20,
  height: 20,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const UploadIcon = () => (
  <svg {...commonProps}>
    <path d="M10 13V3M10 3 6 7M10 3l4 4" />
    <path d="M3 13v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
  </svg>
)

export const DownloadIcon = () => (
  <svg {...commonProps}>
    <path d="M10 3v10M10 13l-4-4M10 13l4-4" />
    <path d="M3 13v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
  </svg>
)

export const EditIcon = () => (
  <svg {...commonProps}>
    <path d="M12.5 3.5 16 7l-9 9H3.5v-3.5z" />
  </svg>
)

export const DeleteIcon = () => (
  <svg {...commonProps}>
    <path d="M4 6h12M8 6V4h4v2M6 6l.7 9.4a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L14 6" />
  </svg>
)

// The four nav-item icons below are used by the mobile bottom tab bar
// (Layout.tsx) — one per top-level route, paired with a visible label so
// they don't rely on shape recognition alone.

export const SetsIcon = () => (
  <svg {...commonProps}>
    <rect x="5" y="3" width="11" height="8" rx="1.2" />
    <path d="M4 9v6a1.2 1.2 0 0 0 1.2 1.2H14" />
  </svg>
)

export const StatsIcon = () => (
  <svg {...commonProps}>
    <path d="M4 17V10M10 17V3M16 17v-6" />
  </svg>
)

export const DocsIcon = () => (
  <svg {...commonProps}>
    <path d="M6 2.5h6l3 3V17a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-14a.5.5 0 0 1 .5-.5Z" />
    <path d="M12 2.5V6h3M7.5 10h5M7.5 13h5" />
  </svg>
)

export const AttributionsIcon = () => (
  <svg {...commonProps}>
    <circle cx="10" cy="7" r="4" />
    <path d="M4 17.5a6 6 0 0 1 12 0" />
  </svg>
)
