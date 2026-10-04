/** Reads a Blob's bytes, falling back to FileReader where `Blob.arrayBuffer` is missing (jsdom, old Safari). */
export const readBlobBytes = (blob: Blob): Promise<ArrayBuffer> => {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('could not read blob'))
    reader.readAsArrayBuffer(blob)
  })
}

const isBlob = (input: ArrayBuffer | Blob): input is Blob =>
  input instanceof Blob || typeof (input as unknown as Blob).arrayBuffer === 'function'

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

/** Lowercase hex SHA-256 of the given bytes. Throws a clear Error when Web Crypto is unavailable. */
export const sha256Hex = async (input: ArrayBuffer | Blob): Promise<string> => {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error('SHA-256 hashing needs crypto.subtle, which requires a secure context (HTTPS or localhost).')
  }
  const bytes = isBlob(input) ? await readBlobBytes(input) : input
  return toHex(new Uint8Array(await subtle.digest('SHA-256', bytes)))
}
