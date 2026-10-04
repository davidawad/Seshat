/**
 * data: URL <-> Blob <-> base64 helpers. Pure and DOM-light so the migration
 * and the backup/import code can be tested without a browser. Every function
 * either returns a value or throws `DataUrlError`; nothing returns partial output.
 */

export class DataUrlError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'DataUrlError'
  }
}

const DATA_URL = /^data:([^,;]*)((?:;[^,;]*)*),(.*)$/s

/** Raw bytes of a base64 string (standard alphabet, padding optional). Throws DataUrlError if it is not valid base64. */
export const base64ToBytes = (base64: string): Uint8Array<ArrayBuffer> => {
  let binary: string
  try {
    binary = atob(base64)
  } catch (cause) {
    throw new DataUrlError('Invalid base64 data.', { cause })
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const CHUNK = 0x8000

/** Base64 of the bytes, built in chunks so large images never overflow the call stack. */
export const bytesToBase64 = (bytes: Uint8Array): string => {
  const parts: string[] = []
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)))
  }
  return btoa(parts.join(''))
}

/** Decodes a `data:<mime>[;base64],<payload>` URL into a Blob typed with its declared mime. */
export const dataUrlToBlob = (dataUrl: string): Blob => {
  const match = DATA_URL.exec(dataUrl)
  if (match === null) throw new DataUrlError('Not a data: URL.')
  const mime = (match[1] ?? '').trim().toLowerCase()
  const params = match[2] ?? ''
  const payload = match[3] ?? ''
  const isBase64 = params.split(';').some((param) => param.trim().toLowerCase() === 'base64')
  let bytes: Uint8Array<ArrayBuffer>
  if (isBase64) {
    bytes = base64ToBytes(payload)
  } else {
    try {
      bytes = new TextEncoder().encode(decodeURIComponent(payload))
    } catch (cause) {
      throw new DataUrlError('Malformed percent-encoding in data: URL.', { cause })
    }
  }
  if (bytes.length === 0) throw new DataUrlError('The data: URL holds no bytes.')
  return new Blob([bytes], { type: mime })
}
