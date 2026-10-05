import { useId } from 'react'
import { TESTIDS } from '../../lib/testids'
import type { Settings } from '../../types'

interface BackupRemindersFieldProps {
  readonly settings: Settings
  readonly updateSettings: (patch: Partial<Settings>) => void
}

/** The "Show backup reminders" toggle for the dismissible backup banner (components/BackupNudge.tsx). */
export const BackupRemindersField = ({ settings, updateSettings }: BackupRemindersFieldProps) => {
  const inputId = useId()
  const hintId = useId()
  return (
    <div className="settings-field">
      <label className="settings-option-inline" htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          data-testid={TESTIDS.settingsBackupReminders}
          aria-describedby={hintId}
          checked={settings.backupRemindersEnabled}
          onChange={(event) => updateSettings({ backupRemindersEnabled: event.target.checked })}
        />
        <span>Show backup reminders</span>
      </label>
      <p id={hintId} className="field-hint">
        A dismissible banner after you save a set, then every 30 days or 50 reviews, to download a backup.
      </p>
    </div>
  )
}
