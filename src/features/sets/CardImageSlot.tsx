import { type ClipboardEvent, type DragEvent, useId, useRef, useState } from 'react'
import { MediaImage, type MediaRef, type processImage, useMediaStore } from '../../lib/media'
import { TESTIDS } from '../../lib/testids'
import { firstImageFile, ingestImageFile } from './ingest-file'
import './card-image-slot.css'

interface CardImageSlotProps {
  /** Which image this is, e.g. "term image" or "definition image". */
  readonly label: string
  /** Disambiguates screen-reader names across rows, e.g. "card 3". */
  readonly context: string
  readonly value: MediaRef | null
  readonly onChange: (next: MediaRef | null) => void
  /** Image pipeline override (tests: jsdom cannot decode or encode images). */
  readonly process?: typeof processImage
}

/**
 * One optional image on a term or definition: pick, paste or drop a file, then
 * replace / remove it and describe it (alt text). Bytes go to the IndexedDB
 * media store; the card only ever holds the small MediaRef. Everything is a
 * plain button / input, so it is fully keyboard operable.
 */
export const CardImageSlot = ({ label, context, value, onChange, process }: CardImageSlotProps) => {
  const store = useMediaStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const altId = useId()
  const errorId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [alt, setAlt] = useState<string | null>(null)

  const accept = (file: File | null) => {
    if (file === null) return
    setError(null)
    setBusy(true)
    ingestImageFile(file, store, process)
      .then((ref) => {
        setAlt(null)
        onChange(value === null ? ref : { ...ref, alt: value.alt })
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not use that image.'))
      .finally(() => setBusy(false))
  }

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const file = firstImageFile(event.clipboardData.files)
    if (file === null) return
    event.preventDefault()
    accept(file)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    setDragging(false)
    const file = firstImageFile(event.dataTransfer.files)
    if (file === null) return
    event.preventDefault()
    accept(file)
  }

  const names = `${label} for ${context}`
  const commitAlt = () => {
    if (value !== null && alt !== null && alt !== value.alt) onChange({ ...value, alt })
    setAlt(null)
  }

  return (
    <div
      className="image-slot"
      data-testid={TESTIDS.imageSlot}
      data-drag={dragging}
      onPaste={handlePaste}
      onDragOver={(event) => {
        if (Array.from(event.dataTransfer.items).some((item) => item.kind === 'file')) {
          event.preventDefault()
          setDragging(true)
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        data-testid={TESTIDS.imageSlotFile}
        aria-label={`Choose ${names}`}
        onChange={(event) => {
          const file = firstImageFile(event.target.files)
          event.target.value = ''
          accept(file)
        }}
      />
      {value === null ? (
        <button
          type="button"
          className="pill-button"
          data-testid={TESTIDS.imageSlotAdd}
          disabled={busy}
          aria-label={`Add ${names}`}
          aria-describedby={error === null ? undefined : errorId}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Adding image...' : `Add ${label}`}
        </button>
      ) : (
        <>
          <span className="image-slot-thumb" data-testid={TESTIDS.imageSlotThumb}>
            <MediaImage media={value} alt={value.alt} />
          </span>
          <label htmlFor={altId} className="sr-only">
            Alt text for {names}
          </label>
          <input
            id={altId}
            type="text"
            className="image-slot-alt"
            data-testid={TESTIDS.imageSlotAlt}
            placeholder="Alt text"
            value={alt ?? value.alt}
            onChange={(event) => setAlt(event.target.value)}
            onBlur={commitAlt}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitAlt()
              }
            }}
          />
          <button
            type="button"
            disabled={busy}
            data-testid={TESTIDS.imageSlotReplace}
            aria-label={`Replace ${names}`}
            onClick={() => inputRef.current?.click()}
          >
            Replace
          </button>
          <button
            type="button"
            data-testid={TESTIDS.imageSlotRemove}
            aria-label={`Remove ${names}`}
            onClick={() => {
              setAlt(null)
              onChange(null)
            }}
          >
            Remove
          </button>
        </>
      )}
      {error !== null && (
        <p id={errorId} className="image-slot-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
