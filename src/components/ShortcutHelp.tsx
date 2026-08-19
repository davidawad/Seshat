export interface Shortcut {
  readonly key: string
  readonly label: string
}

interface ShortcutHelpProps {
  readonly shortcuts: readonly Shortcut[]
}

/**
 * A discoverable legend for a session's active keyboard shortcuts. The
 * shortcuts themselves already work without this (each is hinted inline
 * next to its button) — this just answers "what CAN I press" up front,
 * rather than making someone hunt for hints one button at a time.
 * `<details>` over a custom popover: free keyboard access and toggle state,
 * no JS needed.
 */
export const ShortcutHelp = ({ shortcuts }: ShortcutHelpProps) => (
  <details className="shortcut-help">
    <summary>Keyboard shortcuts</summary>
    <ul>
      {shortcuts.map((shortcut) => (
        <li key={shortcut.key}>
          <kbd>{shortcut.key}</kbd> {shortcut.label}
        </li>
      ))}
    </ul>
  </details>
)
