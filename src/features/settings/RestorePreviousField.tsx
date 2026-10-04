import { useEffect, useState } from 'react'
import { createIdbLegacyStore, type LegacyStore } from '../../lib/media/legacy-store'
import { browserStateStorage, hasLegacyCopy, restoreLegacyCopy } from '../../lib/media/migrate'
import { useSeshatStore } from '../../lib/store'

interface RestorePreviousFieldProps {
  /** Injectable for tests; defaults to the browser's IndexedDB legacy store. */
  readonly legacy?: LegacyStore
}

let browserLegacy: LegacyStore | null = null
const defaultLegacy = (): LegacyStore => (browserLegacy ??= createIdbLegacyStore())

/**
 * "Restore previous version of my data": puts back the copy of your data taken
 * just before images moved to the new storage. Shown only when such a copy
 * exists. Replaces current data, so it asks first (an in-page step, not
 * `window.confirm`) and parks the current data aside so even this is reversible.
 */
export const RestorePreviousField = ({ legacy = defaultLegacy() }: RestorePreviousFieldProps) => {
  const { replaceState } = useSeshatStore()
  const [available, setAvailable] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void hasLegacyCopy(legacy).then((has) => {
      if (!cancelled) setAvailable(has)
    })
    return () => {
      cancelled = true
    }
  }, [legacy])

  if (!available) return null

  const restore = async () => {
    setConfirming(false)
    setError(null)
    const result = await restoreLegacyCopy({ storage: browserStateStorage, legacy })
    if (!result.ok) {
      setError(result.error)
      return
    }
    replaceState(result.value)
    setMessage('Restored the version of your data from before the image upgrade.')
  }

  return (
    <div className="settings-field restore-field">
      <h3>Restore previous version of my data</h3>
      <p className="field-hint">
        When Seshat upgraded how it stores images, it kept a copy of your data from just before. Restoring brings that
        copy back (including any changes you made since the upgrade being lost). Your current data is set aside first.
      </p>
      <button type="button" data-testid="restore-previous" onClick={() => setConfirming(true)}>
        Restore previous version&hellip;
      </button>
      {confirming && (
        <div role="group" aria-label="Confirm restore" data-testid="restore-confirm">
          <p>Replace your current data with the version from before the image upgrade? Changes since then are lost.</p>
          <button
            type="button"
            data-testid="restore-confirm-yes"
            onClick={() => {
              void restore()
            }}
          >
            Restore previous version
          </button>
          <button type="button" data-testid="restore-confirm-cancel" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      )}
      {error !== null && <p role="alert">{error}</p>}
      <p role="status" className="field-hint" data-testid="restore-status">
        {message}
      </p>
    </div>
  )
}
