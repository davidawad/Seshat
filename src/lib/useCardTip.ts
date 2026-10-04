import { useCallback, useSyncExternalStore } from 'react'
import { useSeshatStore } from './store'
import { dismissTip, isTipDismissed, subscribeTipDismissals } from './tipDismissal'

/** `[dismissed, dismiss]` for one tip id; the dismissal is remembered for the session and across visits. */
export const useTipDismissed = (id: string): readonly [boolean, () => void] => {
  const dismissed = useSyncExternalStore(
    subscribeTipDismissals,
    () => isTipDismissed(id),
    () => false,
  )
  const dismiss = useCallback(() => dismissTip(id), [id])
  return [dismissed, dismiss]
}

/** Whether a tip is still shown: "Show card tips" is on and the learner has not yet done what it teaches. */
export const useCardTip = (id: string): { readonly open: boolean; readonly dismiss: () => void } => {
  const {
    state: { settings },
  } = useSeshatStore()
  const [dismissed, dismiss] = useTipDismissed(id)
  return { open: settings.cardTipsEnabled && !dismissed, dismiss }
}
