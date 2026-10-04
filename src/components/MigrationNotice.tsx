import { useState, useSyncExternalStore } from 'react'
import { getMigrationNotice, subscribeMigrationNotice } from '../lib/media/migration-notice'

/**
 * Non-blocking note about the one-time image-storage upgrade (lib/media/
 * migrate.ts): either "moved N images" or "could not finish, nothing lost,
 * will retry". Dismissible; never covers page content (fixed to the top corner).
 */
export const MigrationNotice = () => {
  const notice = useSyncExternalStore(subscribeMigrationNotice, getMigrationNotice)
  const [dismissed, setDismissed] = useState<unknown>(null)
  if (notice === null || dismissed === notice) return null
  return (
    <div
      className="install-prompt migration-notice"
      role={notice.tone === 'warning' ? 'alert' : 'status'}
      data-testid="migration-notice"
    >
      <p>{notice.text}</p>
      <div className="install-prompt-actions">
        <button type="button" className="install-prompt-dismiss" onClick={() => setDismissed(notice)}>
          Dismiss
        </button>
      </div>
    </div>
  )
}
