import { type ChangeEvent, type FormEvent, useId, useState } from 'react'
import { useSeshatStore } from '../../lib/store'
import { exportedDeckSchema } from '../../types'
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

const JsonImportForm = () => {
  const { importDeck } = useSeshatStore()
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const fileId = useId()
  const errorId = useId()

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file === undefined) return

    setError(null)
    setSuccessMessage(null)

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

    const parsed = exportedDeckSchema.safeParse(json)
    if (!parsed.success) {
      setError(
        `That file doesn't match the Seshat deck format: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
      )
      return
    }

    const deck = importDeck(parsed.data)
    setSuccessMessage(`Imported "${deck.name}" (${parsed.data.cards.length} card(s)).`)
  }

  return (
    <div>
      <h3>Import a Seshat JSON export</h3>
      <label htmlFor={fileId}>Choose a .seshat.json file</label>
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
      {error !== null && (
        <p id={errorId} role="alert">
          {error}
        </p>
      )}
      {successMessage !== null && <p role="status">{successMessage}</p>}
    </div>
  )
}

const TextImportForm = () => {
  const { importDeck } = useSeshatStore()
  const [name, setName] = useState('')
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const nameId = useId()
  const textId = useId()
  const errorId = useId()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSuccessMessage(null)

    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      setError('Enter a deck name.')
      return
    }

    const result = parseTermDefinitionText(raw)
    if (!result.ok) {
      setError(result.error)
      return
    }

    setError(null)
    const deck = importDeck({
      seshatExportVersion: 1,
      name: trimmedName,
      description: '',
      tags: [],
      cards: result.value,
    })
    setSuccessMessage(`Imported "${deck.name}" (${result.value.length} card(s)).`)
    setName('')
    setRaw('')
  }

  return (
    <form onSubmit={handleSubmit} aria-labelledby="text-import-heading">
      <h3 id="text-import-heading">Paste term/definition pairs (Quizlet-style)</h3>
      <div>
        <label htmlFor={nameId}>New deck name</label>
        <input id={nameId} type="text" value={name} onChange={(event) => setName(event.target.value)} required />
      </div>
      <div>
        <label htmlFor={textId}>Term and definition, one pair per line</label>
        <p id={`${textId}-hint`}>Separate each pair with a tab (or a comma if there&apos;s no tab on that line).</p>
        <textarea
          id={textId}
          aria-describedby={`${textId}-hint${error !== null ? ` ${errorId}` : ''}`}
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          rows={6}
          required
        />
      </div>
      {error !== null && (
        <p id={errorId} role="alert">
          {error}
        </p>
      )}
      {successMessage !== null && <p role="status">{successMessage}</p>}
      <button type="submit">Import as new deck</button>
    </form>
  )
}

export const ImportPanel = () => (
  <div>
    <h2>Import</h2>
    <JsonImportForm />
    <TextImportForm />
  </div>
)
