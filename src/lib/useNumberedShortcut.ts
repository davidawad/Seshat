import { useEffect } from 'react'
import { matchesBinding } from './keybindings'
import { useKeybindings } from './useKeybindings'

/**
 * Wires a window keydown listener for a "digit key picks option N" surface —
 * MCQ options, Match tiles, Blast/Blocks options, Blocks columns, mode
 * pickers, the games list, etc. Matches a press against the resolved keys
 * for `${actionPrefix}1'..`${actionPrefix}count` (the numbered actions
 * `lib/keybindings.ts`'s `numberedActions` registers) and calls
 * `onSelect(index)` with the matched action's 0-based index.
 *
 * A single reusable implementation for a pattern that would otherwise be
 * duplicated near-identically across every session/list component in the
 * app. Skipped entirely while `active` is false, and while a text input is
 * focused — matching every other keyboard handler in the app.
 */
export const useNumberedShortcut = (
  actionPrefix: string,
  count: number,
  active: boolean,
  onSelect: (index: number) => void,
): void => {
  const { key: keyFor } = useKeybindings()

  useEffect(() => {
    if (!active) return
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      for (let index = 0; index < count; index++) {
        if (matchesBinding(keyFor(`${actionPrefix}${index + 1}`), event)) {
          onSelect(index)
          return
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, actionPrefix, count, keyFor, onSelect])
}
