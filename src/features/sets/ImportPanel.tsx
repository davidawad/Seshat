import { type ChangeEvent, type FormEvent, useId, useState } from 'react'
import { UploadIcon } from '../../components/icons'
import { useSeshatStore } from '../../lib/store'
import { exportedSetSchema } from '../../types'
import { parseSimpleJson } from './simple-json'
import { parseTermDefinitionText } from './text-import'

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

/**
 * One file input handles both of Seshat's JSON shapes: tries the full
 * round-trip format first (preserves cloze/mcq/image-occlusion), falls
 * back to the portable term/definition format (Quizlet's own shape) if
 * that doesn't match. A name field covers files with no name of their own.
 */
const FileImportForm = ({ onDone }: { readonly onDone: () => void }) => {
  const { importSet } = useSeshatStore()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const nameId = useId()
  const fileId = useId()
  const errorId = useId()

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file === undefined) return
    setError(null)

    let text: string
    try {
      text = await readFileAsText(file)
    } catch {
      setError('Could not read that file.')
      return
    }

    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      setError('That file is not valid JSON.')
      return
    }

    const rich = exportedSetSchema.safeParse(json)
    if (rich.success) {
      importSet(rich.data)
      onDone()
      return
    }

    const simple = parseSimpleJson(text)
    if (simple.ok) {
      const trimmedName = name.trim()
      const setName = simple.value.name ?? (trimmedName.length > 0 ? trimmedName : null)
      if (setName === null) {
        setError('This file has no set name — enter one above, or use a file with a "name"/"title" field.')
        return
      }
      importSet({ seshatExportVersion: 1, name: setName, description: '', tags: [], cards: simple.value.cards })
      onDone()
      return
    }

    setError("That file doesn't match either JSON format Seshat understands (see the hint below).")
  }

  return (
    <div>
      <label htmlFor={nameId}>Set name (only used if the file doesn&apos;t include one)</label>
      <input id={nameId} type="text" value={name} onChange={(event) => setName(event.target.value)} />
      <label htmlFor={fileId}>Choose a .json file</label>
      <input
        id={fileId}
        type="file"
        accept="application/json"
        onChange={(event) => {
          void handleChange(event)
        }}
        aria-invalid={error !== null}
        aria-describedby={error !== null ? errorId : undefined}
      />
      <p className="field-hint">
        Either Seshat&apos;s own export, or a plain <code>{'[{term, definition}]'}</code> file — auto-detected.
      </p>
      {error !== null && (
        <p id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

const PasteTextForm = ({ onDone }: { readonly onDone: () => void }) => {
  const { importSet } = useSeshatStore()
  const [name, setName] = useState('')
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const nameId = useId()
  const textId = useId()
  const errorId = useId()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      setError('Enter a set name.')
      return
    }
    const result = parseTermDefinitionText(raw)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    importSet({ seshatExportVersion: 1, name: trimmedName, description: '', tags: [], cards: result.value })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} aria-labelledby="paste-import-heading">
      <h3 id="paste-import-heading">Or paste term/definition pairs</h3>
      <label htmlFor={nameId}>New set name</label>
      <input id={nameId} type="text" value={name} onChange={(event) => setName(event.target.value)} required />
      <label htmlFor={textId}>Term and definition, one pair per line</label>
      <p id={`${textId}-hint`}>Separate each pair with a tab (or a comma if there&apos;s no tab on that line).</p>
      <textarea
        id={textId}
        aria-describedby={`${textId}-hint${error !== null ? ` ${errorId}` : ''}`}
        value={raw}
        onChange={(event) => setRaw(event.target.value)}
        rows={5}
        required
      />
      {error !== null && (
        <p id={errorId} role="alert">
          {error}
        </p>
      )}
      <button type="submit">Import</button>
    </form>
  )
}

/** Collapsed to a single icon button by default — expands into the compact import flow on click. */
export const ImportButton = () => {
  const [open, setOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const panelId = useId()

  const handleDone = () => {
    setSuccessMessage('Imported.')
    setOpen(false)
  }

  return (
    <div className="import-button">
      <button
        type="button"
        className="icon-button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => !current)
          setSuccessMessage(null)
        }}
      >
        <UploadIcon />
        <span className="sr-only">Import a set</span>
      </button>
      {successMessage !== null && <p role="status">{successMessage}</p>}
      {open && (
        <div id={panelId} className="import-panel">
          <FileImportForm onDone={handleDone} />
          <PasteTextForm onDone={handleDone} />
        </div>
      )}
    </div>
  )
}
