import { type ChangeEvent, useEffect, useId, useState } from 'react'
import { type KeybindingAction, type KeybindingScope, describeKeyEvent, sanitizeOverrides } from '../../lib/keybindings'
import { actionsByScope, useKeybindings } from '../../lib/useKeybindings'
import { downloadJson } from '../sets/download'

/**
 * The Settings "Keyboard shortcuts" section: lists every registered action
 * grouped by scope (see `lib/keybindings.ts`), each with a live "current
 * key" display, a "Change" control that records the next keypress, and a
 * per-row reset — plus a download/upload of the whole override map as JSON.
 * Mirrors `ImportPanel.tsx`'s FileReader + `type="file"` upload pattern and
 * `SetDetail.tsx`'s `downloadJson` export pattern.
 */

const SCOPE_LABELS: Record<KeybindingScope, string> = {
  global: 'Global',
  flashcards: 'Flashcards',
  studyAnswer: 'Study — answering (multiple choice)',
  studyConfidence: 'Study — confidence step',
  studyReveal: 'Study — grading step',
  match: 'Match',
  test: 'Test',
  setDetail: 'Set page — mode picker',
  games: 'Games list',
  blast: 'Blast',
  blocksQuestion: 'Blocks — question step',
  blocksPlacing: 'Blocks — placing step',
}

const MODIFIER_KEY_NAMES: ReadonlySet<string> = new Set(['Control', 'Meta', 'Alt', 'Shift'])

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

type ParsedUpload = { readonly ok: true; readonly json: unknown } | { readonly ok: false; readonly error: string }

/** Reads+JSON-parses an uploaded file, collapsing either failure mode into one result so the caller only branches once. */
const parseUploadFile = async (file: File): Promise<ParsedUpload> => {
  let text: string
  try {
    text = await readFileAsText(file)
  } catch {
    return { ok: false, error: 'Could not read that file.' }
  }
  try {
    return { ok: true, json: JSON.parse(text) }
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }
}

/** The applied/ignored summary shown after a successful upload. */
const formatUploadMessage = (appliedCount: number, ignoredActionIds: readonly string[]): string => {
  const appliedText = `Applied ${appliedCount} shortcut${appliedCount === 1 ? '' : 's'}.`
  if (ignoredActionIds.length === 0) return appliedText
  const entryWord = ignoredActionIds.length === 1 ? 'entry' : 'entries'
  return `${appliedText.slice(0, -1)}; ignored ${ignoredActionIds.length} invalid or conflicting ${entryWord} (${ignoredActionIds.join(', ')}).`
}

interface KeybindingRowProps {
  readonly action: KeybindingAction
}

const KeybindingRow = ({ action }: KeybindingRowProps) => {
  const { key: keyFor, conflictFor, setBinding, resetBinding } = useKeybindings()
  const [recording, setRecording] = useState(false)
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)
  const currentKey = keyFor(action.id)
  const isOverridden = currentKey !== action.defaultKey

  // While recording, capture the very next keydown anywhere in the page
  // (capture phase + stopPropagation, so it never also triggers whatever
  // that key would otherwise do — e.g. a study-session grade shortcut
  // firing in the background while Settings is open over it).
  useEffect(() => {
    if (!recording) return
    const handler = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        setRecording(false)
        return
      }
      if (MODIFIER_KEY_NAMES.has(event.key)) return // wait for the real key, not the modifier alone

      const candidate = describeKeyEvent(event)
      const conflict = conflictFor(action.id, action.scope, candidate)
      if (conflict !== null) {
        setConflictMessage(
          `"${candidate}" is already used by "${conflict.label}" in this group — reset or remap that one first.`,
        )
        setRecording(false)
        return
      }
      setConflictMessage(null)
      setBinding(action.id, candidate)
      setRecording(false)
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [recording, action.id, action.scope, conflictFor, setBinding])

  return (
    <div className="keybinding-row">
      <span className="keybinding-label">{action.label}</span>
      <kbd className="keybinding-current">{currentKey}</kbd>
      <button
        type="button"
        className="keybinding-change"
        aria-pressed={recording}
        onClick={() => {
          setConflictMessage(null)
          setRecording(true)
        }}
      >
        {recording ? 'Press a key… (Esc to cancel)' : 'Change'}
      </button>
      <button
        type="button"
        onClick={() => {
          setConflictMessage(null)
          resetBinding(action.id)
        }}
        disabled={!isOverridden}
      >
        Reset
      </button>
      {conflictMessage !== null && (
        <p role="status" className="field-hint keybinding-conflict">
          {conflictMessage}
        </p>
      )}
    </div>
  )
}

export const KeybindingsField = () => {
  const { overrides, resetAll, replaceAll } = useKeybindings()
  const fileId = useId()
  const errorId = useId()
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const grouped = actionsByScope()

  const handleDownload = () => {
    downloadJson('seshat-keybindings.json', overrides)
  }

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file === undefined) return
    setUploadMessage(null)
    setUploadError(null)

    const parsed = await parseUploadFile(file)
    if (!parsed.ok) {
      setUploadError(parsed.error)
      return
    }

    const { overrides: uploaded, ignoredActionIds } = sanitizeOverrides(parsed.json)
    const appliedCount = Object.keys(uploaded).length
    if (appliedCount === 0 && ignoredActionIds.length === 0) {
      setUploadError('That file has no recognizable shortcut entries.')
      return
    }

    replaceAll({ ...overrides, ...uploaded })
    setUploadMessage(formatUploadMessage(appliedCount, ignoredActionIds))
  }

  return (
    <div className="settings-field keybindings-field">
      <h3 className="keybindings-heading">Keyboard shortcuts</h3>
      <p className="field-hint">
        Every keyboard shortcut in Seshat is remappable. Click "Change" on a row and press the new key you want (Esc
        cancels). Shortcuts are grouped by where they're active — the same physical key can mean something different in
        a different group.
      </p>

      <div className="keybindings-io">
        <button type="button" onClick={handleDownload}>
          Download shortcuts as JSON
        </button>
        <button type="button" onClick={resetAll}>
          Reset all to defaults
        </button>
      </div>

      <div className="settings-field">
        <label htmlFor={fileId}>Upload shortcuts JSON</label>
        <input
          id={fileId}
          type="file"
          accept="application/json"
          onChange={(event) => {
            void handleUpload(event)
          }}
          aria-invalid={uploadError !== null}
          aria-describedby={uploadError !== null ? errorId : undefined}
        />
        <p className="field-hint">
          A previously downloaded shortcuts file, or a hand-edited action-id → key JSON object.
        </p>
        {uploadError !== null && (
          <p id={errorId} role="alert">
            {uploadError}
          </p>
        )}
        {uploadMessage !== null && (
          <p role="status" className="field-hint">
            {uploadMessage}
          </p>
        )}
      </div>

      {Array.from(grouped.entries()).map(([scope, actions]) => (
        <fieldset key={scope} className="keybindings-scope">
          <legend>{SCOPE_LABELS[scope]}</legend>
          {actions.map((action) => (
            <KeybindingRow key={action.id} action={action} />
          ))}
        </fieldset>
      ))}
    </div>
  )
}
