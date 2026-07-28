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
