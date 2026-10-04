import { useId, useState } from 'react'
import { DEFAULT_SETTINGS, paletteSchema, type Settings } from '../../types'
import { describeAccent } from './accentStatus'
import { normalizeHex } from './contrast'
import { PALETTES, checkAccent, type ColorMode } from './palettes'
import { useEffectiveMode } from './theme'

interface PaletteFieldProps {
  readonly settings: Pick<Settings, 'palette' | 'customAccent'>
  readonly updateSettings: (patch: Partial<Settings>) => void
}

const Swatch = ({ palette, mode }: { readonly palette: keyof typeof PALETTES; readonly mode: ColorMode }) => {
  const tokens = PALETTES[palette][mode]
  return (
    <span className="palette-swatch" aria-hidden="true" style={{ background: tokens['--color-bg'] }}>
      <span className="palette-swatch-chip" style={{ background: tokens['--color-bg-elevated-2'] }} />
      <span className="palette-swatch-chip" style={{ background: tokens['--color-fg'] }} />
      <span className="palette-swatch-chip" style={{ background: tokens['--color-accent'] }} />
    </span>
  )
}

/**
 * Palette picker: a radio group of swatch cards, an optional custom accent
 * (color input + hex text input, contrast-checked), and a reset. Everything
 * persists through updateSettings and previews live — useApplyTheme applies
 * the saved choice immediately.
 */
export const PaletteField = ({ settings, updateSettings }: PaletteFieldProps) => {
  const name = useId()
  const hintId = useId()
  const hexId = useId()
  const colorId = useId()
  const mode = useEffectiveMode()

  // `null` = mirror the saved value; a string = what the user is typing now
  // (kept even when invalid, so a half-typed hex isn't clobbered).
  const [typed, setTyped] = useState<string | null>(null)
  const draft = typed ?? settings.customAccent ?? ''
  const status = describeAccent(draft, settings, mode)

  const commitAccent = (value: string) => {
    setTyped(value)
    const hex = normalizeHex(value)
    if (value.trim() === '') {
      updateSettings({ customAccent: null })
    } else if (hex !== null && checkAccent(hex, settings.palette, mode).ok) {
      updateSettings({ customAccent: hex })
    }
  }

  const pickerValue = normalizeHex(draft) ?? settings.customAccent ?? PALETTES[settings.palette][mode]['--color-accent']
  const isDefault = settings.palette === DEFAULT_SETTINGS.palette && settings.customAccent === null

  return (
    <fieldset className="settings-field settings-fieldset" data-testid="palette-field">
      <legend>Color palette</legend>
      <p id={hintId} className="field-hint">
        Applies immediately, in both light and dark. Every preset is checked against WCAG contrast thresholds.
      </p>
      <div className="palette-grid" role="radiogroup" aria-label="Color palette" aria-describedby={hintId}>
        {paletteSchema.options.map((palette) => (
          <label key={palette} className="palette-card">
            <input
              type="radio"
              name={name}
              value={palette}
              checked={settings.palette === palette}
              onChange={() => updateSettings({ palette })}
              data-testid={`palette-${palette}`}
            />
            <Swatch palette={palette} mode={mode} />
            <span className="palette-card-name">{PALETTES[palette].label}</span>
            <span className="palette-card-desc">{PALETTES[palette].description}</span>
          </label>
        ))}
      </div>

      <div className="accent-row">
        <label htmlFor={colorId}>Custom accent color</label>
        <input
          id={colorId}
          type="color"
          value={pickerValue}
          onChange={(event) => commitAccent(event.target.value)}
          data-testid="accent-color"
        />
        <label htmlFor={hexId}>Custom accent hex</label>
        <input
          id={hexId}
          type="text"
          inputMode="text"
          spellCheck={false}
          autoComplete="off"
          placeholder="#3a7bd5"
          value={draft}
          onChange={(event) => commitAccent(event.target.value)}
          aria-invalid={!status.valid}
          data-testid="accent-hex"
        />
        <button
          type="button"
          disabled={isDefault && typed === null}
          onClick={() => {
            setTyped(null)
            updateSettings({ palette: DEFAULT_SETTINGS.palette, customAccent: null })
          }}
          data-testid="palette-reset"
        >
          Reset to default
        </button>
      </div>
      <output className={status.valid ? 'field-hint' : 'field-hint accent-error'} data-testid="accent-status">
        {status.message}
      </output>
    </fieldset>
  )
}
