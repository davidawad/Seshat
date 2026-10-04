import { useId } from 'react'
import { KeybindingsField } from '../features/settings/KeybindingsField'
import {
  KEYBINDING_SCOPE_LABELS,
  NAV_PRESETS,
  NAV_PRESET_LABELS,
  type NavPresetId,
  detectNavPreset,
  formatKeyLabel,
} from '../lib/keybindings'
import { actionsByScope, useKeybindings } from '../lib/useKeybindings'
import { Modal } from './Modal'
import './shortcuts-modal.css'

interface ShortcutsModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly titleId: string
}

const PRESET_IDS = Object.keys(NAV_PRESETS) as NavPresetId[]

/**
 * Every keyboard shortcut in the app, opened from the footer: a two-column
 * reference (label left, bold-outlined key cap right) grouped by where each
 * shortcut applies, a one-click preset for the arrow-style navigation keys
 * (arrows / WASD / HJKL), and the full per-action remap editor. Built straight
 * from `KEYBINDING_REGISTRY` and the user's overrides, so it can never drift
 * from what the keys actually do.
 */
export const ShortcutsModal = ({ open, onClose, titleId }: ShortcutsModalProps) => {
  const { key: keyFor, setBinding, resetBinding } = useKeybindings()
  const presetGroupId = useId()
  const currentPreset = detectNavPreset(keyFor)

  const applyPreset = (id: NavPresetId) => {
    for (const [actionId, key] of Object.entries(NAV_PRESETS[id])) {
      if (id === 'arrows') resetBinding(actionId)
      else setBinding(actionId, key)
    }
  }

  return (
    <Modal open={open} onClose={onClose} titleId={titleId} title="Keyboard shortcuts">
      <div className="shortcuts-modal">
        <fieldset className="shortcuts-presets" aria-labelledby={presetGroupId}>
          <legend id={presetGroupId}>Navigation keys</legend>
          <div className="shortcuts-preset-options">
            {PRESET_IDS.map((id) => (
              <label key={id} className="shortcuts-preset">
                <input
                  type="radio"
                  name="nav-preset"
                  checked={currentPreset === id}
                  onChange={() => applyPreset(id)}
                  data-testid={`nav-preset-${id}`}
                />
                <span>{NAV_PRESET_LABELS[id]}</span>
              </label>
            ))}
            {currentPreset === 'custom' && <span className="shortcuts-preset-custom">Custom</span>}
          </div>
        </fieldset>

        {[...actionsByScope()].map(([scope, actions]) => (
          <section key={scope} aria-label={KEYBINDING_SCOPE_LABELS[scope]}>
            <h3>{KEYBINDING_SCOPE_LABELS[scope]}</h3>
            <ul className="shortcuts-grid">
              {actions.map((action) => (
                <li key={action.id}>
                  <span className="shortcuts-label">{action.label}</span>
                  <kbd>{formatKeyLabel(keyFor(action.id))}</kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <details className="shortcuts-customize">
          <summary>Customize keys</summary>
          <KeybindingsField />
        </details>
      </div>
    </Modal>
  )
}
