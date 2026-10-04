import { useSeshatStore } from '../lib/store'
import { TESTIDS } from '../lib/testids'

const QUOTA_MESSAGE =
  "Your browser's storage is full: recent changes are NOT saved. Export a backup (Settings) or delete unused sets/images."
const GENERIC_MESSAGE = 'Could not save your changes to this browser. Recent changes may be lost on reload.'

/** Persistent alert shown while the most recent save failed; disappears after the next successful save. */
export const SaveErrorBanner = ({ onOpenSettings }: { readonly onOpenSettings: () => void }) => {
  const { saveError } = useSeshatStore()
  if (saveError === null) return null
  return (
    <div role="alert" className="save-error-banner" data-testid={TESTIDS.layoutSaveError}>
      <p>{saveError.kind === 'quota-exceeded' ? QUOTA_MESSAGE : GENERIC_MESSAGE}</p>
      <button type="button" onClick={onOpenSettings} data-testid={TESTIDS.layoutSaveErrorSettings}>
        Open Settings
      </button>
    </div>
  )
}
