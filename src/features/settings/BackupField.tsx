import { type ChangeEvent, useId, useState } from 'react'
import { type Backup, type ImportMode, backupFilename, describeImport, parseBackup } from '../../lib/backup'
import { useSeshatStore } from '../../lib/store'
import { useKeybindings } from '../../lib/useKeybindings'
import { downloadJson } from '../sets/download'

/**
 * The Settings "Backup" section: download everything (settings, keyboard
 * shortcuts, sets, cards, review history) as one JSON file, and restore
 * from one. Mirrors `KeybindingsField.tsx`'s FileReader + `type="file"`
 * pattern. Merge is the default and only adds what is missing; Replace
 * overwrites everything, so it is parked behind an inline confirmation
 * (an in-page step, not `window.confirm`, so it stays reachable through
 * the accessibility tree) before anything is touched.
 */

const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('File did not read as text.'))
    }
    reader.onerror = () => reject(new Error('Could not read the file.'))
    reader.readAsText(file)
  })

export const BackupField = () => {
  const { exportAll, importAll } = useSeshatStore()
  const { replaceAll: replaceKeybindings } = useKeybindings()
  const [mode, setMode] = useState<ImportMode>('merge')
  const [pending, setPending] = useState<Backup | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const fileId = useId()
  const errorId = useId()
  const modeName = useId()

  const apply = (backup: Backup, chosenMode: ImportMode) => {
    const result = importAll(backup, chosenMode)
    setPending(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    // The store persisted these; the keybindings store is a separate live
    // singleton, so push them in too or the open tab keeps the old keymap.
    if (result.value.keybindings !== null) replaceKeybindings(result.value.keybindings)
    setMessage(describeImport(result.value))
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file === undefined) return
    setError(null)
    setMessage(null)
    setPending(null)

    let text: string
    try {
      text = await readFileAsText(file)
    } catch {
      setError('Could not read that file.')
      return
    }

    const parsed = parseBackup(text)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    if (mode === 'replace') setPending(parsed.value)
    else apply(parsed.value, 'merge')
  }

  const handleDownload = () => {
    const now = new Date()
    downloadJson(backupFilename(now), exportAll())
    setError(null)
    setMessage('Downloaded a backup of all your data.')
  }

  return (
    <div className="settings-field backup-field">
      <h3>Backup</h3>
      <p className="field-hint">
        One JSON file with all your settings, keyboard shortcuts, sets, cards and review history.
      </p>
      <button type="button" data-testid="backup-download" onClick={handleDownload}>
        Download all data (JSON)
      </button>

      <fieldset>
        <legend>When restoring a backup</legend>
        <label>
          <input
            type="radio"
            name={modeName}
            value="merge"
            data-testid="backup-mode-merge"
            checked={mode === 'merge'}
            onChange={() => setMode('merge')}
          />
          Merge — add sets and cards that are missing, keep everything already here
        </label>
        <label>
          <input
            type="radio"
            name={modeName}
            value="replace"
            data-testid="backup-mode-replace"
            checked={mode === 'replace'}
            onChange={() => setMode('replace')}
          />
          Replace — overwrite all current data and settings with the backup
        </label>
      </fieldset>

      <label htmlFor={fileId}>Restore from backup file (.json)</label>
      <input
        id={fileId}
        type="file"
        accept="application/json"
        data-testid="backup-file"
        onChange={(event) => {
          void handleFile(event)
        }}
        aria-invalid={error !== null}
        aria-describedby={error !== null ? errorId : undefined}
      />

      {pending !== null && (
        <div role="group" aria-label="Confirm replace" data-testid="backup-confirm">
          <p>
            Replace everything with this backup ({pending.sets.length} sets, {pending.cards.length} cards)? Your current
            sets, review history and settings will be overwritten. This cannot be undone.
          </p>
          <button type="button" data-testid="backup-confirm-replace" onClick={() => apply(pending, 'replace')}>
            Replace everything
          </button>
          <button type="button" data-testid="backup-confirm-cancel" onClick={() => setPending(null)}>
            Cancel
          </button>
        </div>
      )}

      {error !== null && (
        <p id={errorId} role="alert">
          {error}
        </p>
      )}
      <p role="status" className="field-hint" data-testid="backup-status">
        {message}
      </p>
    </div>
  )
}
