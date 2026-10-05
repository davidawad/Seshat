import { shouldShowBackupNudge } from '../lib/activation'
import { useSeshatStore } from '../lib/store'
import { TESTIDS } from '../lib/testids'

/**
 * Dismissible, non-blocking reminder that cards live only in this browser. Shown once a real (non-sample) set has been
 * saved, then again every 30 days or 50 reviews after the latest backup or dismissal (lib/activation.ts). The button
 * opens Settings, where the existing Backup download lives. Nothing here leaves the device.
 */
export const BackupNudge = ({ onOpenSettings }: { readonly onOpenSettings: () => void }) => {
  const { state, dismissBackupNudge } = useSeshatStore()
  if (!shouldShowBackupNudge(state.activation, new Date(), state.settings.backupRemindersEnabled)) return null
  return (
    <div role="region" aria-label="Backup reminder" className="backup-nudge" data-testid={TESTIDS.backupNudge}>
      <p>Your cards are saved on this device only.</p>
      <button type="button" onClick={onOpenSettings} data-testid={TESTIDS.backupNudgeDownload}>
        Download a backup
      </button>
      <button type="button" onClick={dismissBackupNudge} data-testid={TESTIDS.backupNudgeDismiss}>
        Dismiss
      </button>
    </div>
  )
}
