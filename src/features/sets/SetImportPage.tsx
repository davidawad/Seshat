import { type ChangeEvent, type DragEvent, type FormEvent, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UploadIcon } from '../../components/icons'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import { countPastedCards, isTextFile, parseUploadedFile, suggestSetName } from './file-import'
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

const QUIZLET_STEPS = [
  'On Quizlet, open your set, choose the three-dot menu, then Export.',
  'Pick Tab between term and definition and New line between rows, then copy the text (or save it as a .txt file).',
  'Paste it below, or upload the file, check the card count, and press Import.',
] as const

const QuizletGuide = () => (
  <section aria-labelledby="import-quizlet-heading" className="import-guide" data-testid={TESTIDS.importQuizletGuide}>
    <h2 id="import-quizlet-heading">Coming from Quizlet?</h2>
    <ol>
      {QUIZLET_STEPS.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
    <p className="field-hint">
      Quizlet&rsquo;s menus change from time to time. Any list with one term and definition per line, split by a tab or
      a comma, imports the same way.
    </p>
  </section>
)

const AdvancedNotes = () => (
  <details className="import-advanced" data-testid={TESTIDS.importAdvanced}>
    <summary>Advanced / agents</summary>
    <p>
      The upload box above also takes <code>.json</code>: a Seshat export (keeps cloze, multiple-choice, images and
      tags) or a plain <code>{'[{term, definition}]'}</code> array. Ask an LLM for that array and save it as a file.
    </p>
    <p>
      Scripts and agents can skip this page: <code>?import=</code> in the URL, <code>window.seshat</code> and the WebMCP
      tools are described in the <a href={`${import.meta.env.BASE_URL}agents.txt`}>agent guide</a> and on the{' '}
      <Link to="/docs">Docs</Link> page.
    </p>
  </details>
)

/** The live card-count line: counted from a chosen text file, else the paste box; empty for a JSON file. */
const previewMessage = (file: StagedFile | null, raw: string): string => {
  const text = file === null ? raw : isTextFile(file.name, file.text) ? file.text : ''
  if (text.trim().length === 0) return ''
  const count = countPastedCards(text)
  return `${count} ${count === 1 ? 'card' : 'cards'} parsed from ${file === null ? 'the pasted text' : file.name}.`
}

/**
 * `/sets/import` — the whole page is the import form, Quizlet-first: three export
 * steps, then paste term/definition lines or upload a .csv/.tsv/.txt file, name the
 * set (suggested from the file name), press Import. Seshat/simple JSON files still
 * work through the same upload and live under "Advanced / agents". A chosen file takes
 * priority over pasted text. Parsing lives in `file-import.ts`; this is only the form.
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
      setName((current) => (current.trim().length === 0 ? suggestSetName(chosen.name) : current))
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
    const result =
      file === null ? parseUploadedFile('paste.txt', raw, name) : parseUploadedFile(file.name, file.text, name)
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

  const describedBy = error !== null ? errorId : undefined

  return (
    <section aria-labelledby="import-heading" data-testid={TESTIDS.importPage} className="set-import">
      <p className="page-back">
        <Link to="/sets" data-testid={TESTIDS.importBack}>
          Back
        </Link>
      </p>
      <h1 id="import-heading">Import a set</h1>

      <QuizletGuide />

      <form
        onSubmit={(event) => {
          void handleSubmit(event)
        }}
        noValidate
        aria-labelledby="import-heading"
      >
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
            {previewMessage(file, raw)}
          </p>
        </div>

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
          <span className="import-dropzone-title">Or upload a .csv, .tsv or .txt file</span>
          <span className="field-hint">Choose or drop a Quizlet export or any term,definition list.</span>
          <input
            id={fileId}
            type="file"
            className="import-file-input"
            data-testid={TESTIDS.importFile}
            accept=".csv,.tsv,.txt,.json,text/csv,text/tab-separated-values,text/plain,application/json"
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
            Required for pasted text and for files without a name of their own. Filled in from the file name when you
            choose one.
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
      <AdvancedNotes />
    </section>
  )
}
