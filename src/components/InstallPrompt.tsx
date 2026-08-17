import { useEffect, useState } from 'react'

/**
 * Chrome/Android's `beforeinstallprompt` — not in lib.dom.d.ts, since it's a
 * non-standard Chromium-only event.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly prompt: () => Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

/**
 * Chromium browsers fire `beforeinstallprompt` instead of showing their own
 * install affordance once the page calls `preventDefault()` on it — without
 * that, install depends entirely on a learner noticing a small, easy-to-miss
 * browser-chrome icon. This stashes the deferred event and offers a small
 * dismissible banner instead; disappears for the rest of the session once
 * installed or dismissed (no re-prompting on every page). Renders nothing on
 * browsers that never fire the event (Safari/Firefox), so it's a pure
 * progressive enhancement.
 */
export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (deferredPrompt === null) return null

  const handleInstall = () => {
    void deferredPrompt.prompt()
    // The prompt can only be used once regardless of outcome — hide the
    // banner as soon as the browser reports a choice either way.
    void deferredPrompt.userChoice.finally(() => setDeferredPrompt(null))
  }

  return (
    <div className="install-prompt" role="complementary" aria-label="Install Seshat">
      <p>Install Seshat for quicker access and offline study.</p>
      <div className="install-prompt-actions">
        <button type="button" onClick={handleInstall}>
          Install Seshat
        </button>
        <button type="button" className="install-prompt-dismiss" onClick={() => setDeferredPrompt(null)}>
          Not now
        </button>
      </div>
    </div>
  )
}
