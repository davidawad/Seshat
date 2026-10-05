import { Command, useCommandState } from 'cmdk'
import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { backupFilename } from '../../lib/backup'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import { downloadJson } from '../sets/download'
import { buildPaletteItems, groupPaletteItems, nextTheme, type PaletteItem } from './palette-items'
import './command-palette.css'

export interface CommandPaletteProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onOpenSettings: () => void
  readonly onOpenShortcuts: () => void
}

/** Polite live-region text for the current match count (cmdk exposes the filtered count but announces nothing itself). */
const ResultStatus = () => {
  const count = useCommandState((state) => state.filtered.count)
  return (
    <div className="sr-only" role="status" data-testid={TESTIDS.paletteStatus}>
      {count === 0 ? 'No results' : `${count} ${count === 1 ? 'result' : 'results'}`}
    </div>
  )
}

/**
 * The Cmd/Ctrl+K command menu: a native modal `<dialog>` (focus trap, Escape,
 * focus restore to the opener — same pattern as components/Modal.tsx) wrapping
 * cmdk's headless `Command` for fuzzy filtering, the listbox/option roles and
 * arrow/Enter handling. cmdk's own `Command.Dialog` is deliberately not used:
 * it would add Radix's dialog stack to the UI for nothing the native element
 * doesn't already do. Lazy-loaded from Layout, so cmdk is not in the main bundle.
 */
export const CommandPalette = ({ open, onClose, onOpenSettings, onOpenShortcuts }: CommandPaletteProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const navigate = useNavigate()
  const { state, updateSettings, exportAll } = useSeshatStore()
  const { theme } = state.settings

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return
    if (open && !dialog.open) {
      dialog.showModal()
      // showModal() focuses the first focusable node, which is cmdk's root
      // wrapper, not the search box; React's autoFocus ran before the dialog opened.
      dialog.querySelector<HTMLInputElement>('input')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  const groups = useMemo(
    () => groupPaletteItems(buildPaletteItems(state.sets, state.cards, theme)),
    [state.sets, state.cards, theme],
  )

  const run = (item: PaletteItem) => {
    onClose()
    if (item.target.kind === 'route') {
      navigate(item.target.to)
      return
    }
    switch (item.target.action) {
      case 'openSettings':
        onOpenSettings()
        return
      case 'openShortcuts':
        onOpenShortcuts()
        return
      case 'toggleTheme':
        updateSettings({ theme: nextTheme(theme) })
        return
      case 'exportBackup': {
        const now = new Date()
        downloadJson(backupFilename(now), exportAll())
        return
      }
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="palette"
      aria-label="Command menu"
      data-testid={TESTIDS.palette}
      onClose={onClose}
      onClick={(event) => {
        // A click on the <dialog> element itself is a click on its backdrop.
        if (event.target === dialogRef.current) onClose()
      }}
    >
      {/* Mounted only while open so every opening starts with an empty query. */}
      {open && (
        <Command className="palette-command" label="Command menu" loop>
          <Command.Input
            className="palette-input"
            placeholder="Search pages, sets and actions…"
            data-testid={TESTIDS.paletteInput}
          />
          <Command.List className="palette-list" label="Results" data-testid={TESTIDS.paletteList}>
            <Command.Empty className="palette-empty" data-testid={TESTIDS.paletteEmpty}>
              No results
            </Command.Empty>
            {groups.map(({ group, items }) => (
              <Command.Group key={group} heading={group} className="palette-group">
                {items.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={item.label}
                    keywords={[...item.keywords]}
                    className="palette-item"
                    data-testid={TESTIDS.paletteItem}
                    onSelect={() => run(item)}
                  >
                    <span className="palette-item-label">{item.label}</span>
                    {item.hint !== undefined && <span className="palette-item-hint">{item.hint}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
          <ResultStatus />
        </Command>
      )}
    </dialog>
  )
}
