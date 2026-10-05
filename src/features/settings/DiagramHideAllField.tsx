import { useId } from 'react'
import { TESTIDS } from '../../lib/testids'
import type { Settings } from '../../types'

interface DiagramHideAllFieldProps {
  readonly settings: Settings
  readonly updateSettings: (patch: Partial<Settings>) => void
}

/** The "Hide all labels on diagrams" toggle: what a labelled-diagram question masks while studying. */
export const DiagramHideAllField = ({ settings, updateSettings }: DiagramHideAllFieldProps) => {
  const inputId = useId()
  const hintId = useId()
  return (
    <div className="settings-field">
      <label className="settings-option-inline" htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          data-testid={TESTIDS.settingsDiagramHideAll}
          checked={settings.diagramHideAllLabels}
          onChange={(event) => updateSettings({ diagramHideAllLabels: event.target.checked })}
          aria-describedby={hintId}
        />
        <span>Hide all labels on diagrams</span>
      </label>
      <p id={hintId} className="field-hint">
        Off: studying a diagram label hides only that label and leaves the others visible as clues. On: every label on
        the diagram is hidden.
      </p>
    </div>
  )
}
