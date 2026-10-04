import { useId } from 'react'
import { themeSchema, type Settings, type Theme } from '../../types'

const THEME_LABELS: Record<Theme, string> = {
  system: 'Match system',
  light: 'Light',
  dark: 'Dark',
}

// Segmented order reads left-to-right as "auto, then the two fixed modes".
const THEME_ORDER: readonly Theme[] = ['system', 'light', 'dark']

if (THEME_ORDER.length !== themeSchema.options.length) {
  throw new Error('THEME_ORDER is out of sync with themeSchema')
}

interface ThemeFieldProps {
  readonly settings: Pick<Settings, 'theme'>
  readonly updateSettings: (patch: Partial<Settings>) => void
}

/**
 * Light/dark switcher: a native radio group styled as a segmented control.
 * Native radios give arrow-key navigation, a single tab stop and screen-
 * reader "n of 3" semantics for free; selecting one applies immediately
 * (useApplyTheme reacts to the saved setting), so the page itself is the
 * live preview.
 */
export const ThemeField = ({ settings, updateSettings }: ThemeFieldProps) => {
  const name = useId()
  const hintId = useId()
  return (
    <fieldset className="settings-field settings-fieldset" data-testid="theme-field">
      <legend>Theme</legend>
      <p id={hintId} className="field-hint">
        Applies immediately. “Match system” follows your device&rsquo;s light/dark setting.
      </p>
      <div className="segmented" role="radiogroup" aria-label="Theme" aria-describedby={hintId}>
        {THEME_ORDER.map((theme) => (
          <label key={theme} className="segmented-option">
            <input
              type="radio"
              name={name}
              value={theme}
              checked={settings.theme === theme}
              onChange={() => updateSettings({ theme })}
              data-testid={`theme-${theme}`}
            />
            <span>{THEME_LABELS[theme]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
