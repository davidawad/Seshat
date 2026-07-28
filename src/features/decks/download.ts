/** Slugifies a deck name for use in a downloaded filename. */
export const slugify = (name: string): string => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
  return slug.length > 0 ? slug : 'deck'
}

/** Triggers a browser download of `data` (serialized as pretty JSON) as `filename`. */
export const downloadJson = (filename: string, data: unknown): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  } finally {
    URL.revokeObjectURL(url)
  }
}
