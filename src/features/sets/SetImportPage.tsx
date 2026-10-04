import { type ChangeEvent, type DragEvent, type FormEvent, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UploadIcon } from '../../components/icons'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import { countPastedCards, parseImportFile, parsePastedSet } from './file-import'
import './set-create.css'

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

interface StagedFile {
  readonly name: string
  readonly text: string
}

/**
 * `/sets/import` — the whole page is the import form: upload a .json file
 * (Seshat export or plain `[{term, definition}]`) and/or paste term/definition
 * lines, name the set, press Import. A chosen file takes priority over pasted
 * text. Parsing lives in `file-import.ts`; this is only the form.
 */
export const SetImportPage = () => {
  const { importSet, prepareSetImport } = useSeshatStore()
  const navigate = useNavigate()
  const [file, setFile] = useState<StagedFile | null>(null)
  const [name, setName] = useState('')
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileId = useId()
  const nameId = useId()
  const textId = useId()
  const errorId = useId()

  const stage = async (chosen: File | undefined) => {
    if (chosen === undefined) return
    setError(null)
    try {
      setFile({ name: chosen.name, text: await readFileAsText(chosen) })
    } catch {
      setFile(null)
      setError('Could not read that file.')
    }
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0]
    event.target.value = ''
    void stage(chosen)
  }

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setDragging(false)
    void stage(event.dataTransfer.files[0])
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = file === null ? parsePastedSet(raw, name) : parseImportFile(file.text, name)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    // Store the file's images (or convert v1-era inline ones) before the cards that use them appear.
    const prepared = await prepareSetImport(result.value)
    if (!prepared.ok) {
      setError(prepared.error)
      return
    }
    const set = importSet(prepared.value)
    navigate(`/sets/${set.id}`)
  }

  const count = countPastedCards(raw)
  const describedBy = error !== null ? errorId : undefined

  return (
    <section aria-labelledby="import-heading" data-testid={TESTIDS.importPage} className="set-import">
      <p className="page-back">
        <Link to="/sets" data-testid={TESTIDS.importBack}>
          Back
        </Link>
      </p>
      <h1 id="import-heading">Import a set</h1>

      <form
        onSubmit={(event) => {
          void handleSubmit(event)
        }}
        noValidate
        aria-labelledby="import-heading"
      >
        <label
          htmlFor={fileId}
          className={`import-dropzone${dragging ? ' is-dragging' : ''}`}
          data-testid={TESTIDS.importDropzone}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <UploadIcon />
          <span className="import-dropzone-title">Upload a .json file</span>
          <span className="field-hint">
            Choose or drop a Seshat export, or a plain <code>{'[{term, definition}]'}</code> file.
          </span>
          <input
            id={fileId}
            type="file"
            className="import-file-input"
            data-testid={TESTIDS.importFile}
            accept="application/json,.json"
            aria-describedby={describedBy}
            onChange={handleChange}
          />
        </label>
        {file !== null && (
          <p className="import-dropzone-file" data-testid={TESTIDS.importFileName}>
            Ready to import: {file.name}{' '}
            <button type="button" onClick={() => setFile(null)}>
              Remove file
            </button>
          </p>
        )}

        <div className="import-field">
          <label htmlFor={textId}>Paste terms and definitions</label>
          <textarea
            id={textId}
            data-testid={TESTIDS.importPasteText}
            aria-describedby={`${textId}-hint`}
            value={raw}
            placeholder={'Term\tDefinition\nAnother term\tIts definition'}
            onChange={(event) => setRaw(event.target.value)}
          />
          <p id={`${textId}-hint`} className="field-hint">
            One pair per line. Separate each pair with a tab, or a comma if there is no tab on that line. A chosen file
            is used instead of pasted text.
          </p>
          <p role="status" className="import-preview" data-testid={TESTIDS.importPreview}>
            {raw.trim().length === 0 ? '' : `${count} ${count === 1 ? 'card' : 'cards'} parsed from the pasted text.`}
          </p>
        </div>

        <div className="import-field">
          <label htmlFor={nameId}>Set name</label>
          <input
            id={nameId}
            type="text"
            data-testid={TESTIDS.importPasteName}
            value={name}
            aria-describedby={`${nameId}-hint`}
            onChange={(event) => setName(event.target.value)}
          />
          <p id={`${nameId}-hint`} className="field-hint">
            Required for pasted text. For a file, only used if the file has no name of its own.
          </p>
        </div>

        {error !== null && (
          <p id={errorId} role="alert" className="field-error" data-testid={TESTIDS.importError}>
            {error}
          </p>
        )}

        <button type="submit" className="primary-button import-submit" data-testid={TESTIDS.importPasteSubmit}>
          Import
        </button>
      </form>
    </section>
  )
}
