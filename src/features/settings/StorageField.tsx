import { useCallback, useEffect, useState } from 'react'
import { cleanUpUnusedImages } from '../../lib/media/cleanup'
import { withWebLock } from '../../lib/media/locks'
import { migrationPending } from '../../lib/media/migrate'
import { useMediaStore } from '../../lib/media/MediaStoreProvider'
import type { MediaUsage } from '../../lib/media/store'
import { loadState } from '../../lib/storage'

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/** Settings "Storage": how much room the images use, and an on-demand clean-up of images nothing uses any more. */
export const StorageField = () => {
  const store = useMediaStore()
  const [usage, setUsage] = useState<MediaUsage | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setUsage(await store.usage())
      setUnavailable(false)
    } catch {
      setUnavailable(true)
    }
  }, [store])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const cleanUp = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await cleanUpUnusedImages({
        store,
        readState: loadState,
        migrationPending: () => migrationPending(),
        withLock: withWebLock,
      })
      setMessage(
        result.status === 'skipped'
          ? result.reason
          : result.deleted === 0
            ? 'No unused images to remove. (Images newer than 24 hours are always kept.)'
            : `Removed ${result.deleted} unused image${result.deleted === 1 ? '' : 's'}, freeing ${formatBytes(result.freedBytes)}.`,
      )
    } catch {
      setMessage('Could not clean up images. Nothing was changed.')
    } finally {
      setBusy(false)
      await refresh()
    }
  }

  return (
    <div className="settings-field storage-field">
      <h3>Storage</h3>
      {unavailable ? (
        <p className="field-hint" data-testid="storage-usage">
          Image storage is not available in this browser context.
        </p>
      ) : usage === null ? (
        <p className="field-hint">Checking storage&hellip;</p>
      ) : (
        <ul className="field-hint" data-testid="storage-usage">
          <li>
            Images: {usage.count} ({formatBytes(usage.bytes)})
          </li>
          {usage.quota !== undefined && <li>Browser allowance for this site: about {formatBytes(usage.quota)}</li>}
          {usage.persisted !== undefined && (
            <li>
              Protected from automatic clearing:{' '}
              {usage.persisted ? 'yes' : 'no (the browser may clear it if the device runs low on space)'}
            </li>
          )}
        </ul>
      )}
      <button
        type="button"
        data-testid="storage-cleanup"
        disabled={busy || unavailable}
        onClick={() => {
          void cleanUp()
        }}
      >
        Clean up unused images
      </button>
      <p role="status" className="field-hint" data-testid="storage-status">
        {message}
      </p>
    </div>
  )
}
