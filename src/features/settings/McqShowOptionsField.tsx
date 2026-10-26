import { useId } from 'react'
import type { Settings } from '../../types'

interface McqShowOptionsFieldProps {
  readonly settings: Settings
  readonly updateSettings: (patch: Partial<Settings>) => void
}

/** The "Hide multiple-choice options until I press Show options" toggle (default off: options appear at once). */
export const McqShowOptionsField = ({ settings, updateSettings }: McqShowOptionsFieldProps) => {
  const inputId = useId()
  const hintId = useId()
  return (
    <div className="settings-field">
      <label className="settings-option-inline" htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          checked={settings.mcqShowOptionsOnRequest}
          onChange={(event) => updateSettings({ mcqShowOptionsOnRequest: event.target.checked })}
          aria-describedby={hintId}
        />
        <span>Hide multiple-choice options until I press "Show options"</span>
      </label>
      <p id={hintId} className="field-hint">
        Off by default: the options appear at once, in a row below the card. On, the card shows only the question first,
        so you try to recall the answer before seeing choices to recognise.
      </p>
    </div>
  )
}
