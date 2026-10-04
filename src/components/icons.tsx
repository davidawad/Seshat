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

// Flashcards control-bar icons (features/flashcards/FlashcardControls.tsx).

export const CheckIcon = () => (
  <svg {...commonProps}>
    <path d="m4 10.5 4 4 8-9" />
  </svg>
)

export const CrossIcon = () => (
  <svg {...commonProps}>
    <path d="m5 5 10 10M15 5 5 15" />
  </svg>
)

export const UndoIcon = () => (
  <svg {...commonProps}>
    <path d="M7 4 3.5 7.5 7 11" />
    <path d="M3.5 7.5H12a4.5 4.5 0 0 1 0 9H8" />
  </svg>
)

export const ShuffleIcon = () => (
  <svg {...commonProps}>
    <path d="M3 5.5h2.5c3 0 4 9 7 9H17M3 14.5h2.5c1.2 0 2-1.4 2.8-3M12.5 5.5H17M15 3l2 2.5-2 2.5M15 12l2 2.5-2 2.5" />
  </svg>
)

export const GearIcon = () => (
  <svg {...commonProps}>
    {/* An 8-tooth cog outline with a centre hole — a ray-ed circle reads as a sun. */}
    <path d="M7.98 4.14 L8.16 2.01 L11.84 2.01 L12.02 4.14 L12.72 4.43 L14.35 3.05 L16.95 5.65 L15.57 7.28 L15.86 7.98 L17.99 8.16 L17.99 11.84 L15.86 12.02 L15.57 12.72 L16.95 14.35 L14.35 16.95 L12.72 15.57 L12.02 15.86 L11.84 17.99 L8.16 17.99 L7.98 15.86 L7.28 15.57 L5.65 16.95 L3.05 14.35 L4.43 12.72 L4.14 12.02 L2.01 11.84 L2.01 8.16 L4.14 7.98 L4.43 7.28 L3.05 5.65 L5.65 3.05 L7.28 4.43Z" />
    <circle cx="10" cy="10" r="2.6" />
  </svg>
)
