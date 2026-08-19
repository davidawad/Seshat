import { useEffect, useState } from 'react'
import { useSeshatStore } from '../lib/store'

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
 *
 * Gated behind `settings.installPromptEnabled` (off by default — see
 * types.ts). When off, the listener never even attaches, so this never
 * calls `preventDefault()` on the event either — the browser's own native
 * install affordance (if any) is left to do its own thing instead of being
 * suppressed in favor of a banner the user has said they don't want.
 */
export const InstallPrompt = () => {
  const {
    state: {
      settings: { installPromptEnabled },
    },
  } = useSeshatStore()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (!installPromptEnabled) return
    const handler = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [installPromptEnabled])

  // The banner is `position: fixed` (see index.css) so it doesn't reflow
  // when it appears/disappears — but that means it floats OVER whatever's
  // at the bottom of the page unless something reserves space for it. This
  // toggles a class on <body> that index.css uses to pad the page's own
  // bottom edge only while the banner is actually visible, rather than
  // wasting that space on every page for everyone who never sees it.
  useEffect(() => {
    document.body.classList.toggle('has-install-prompt', installPromptEnabled && deferredPrompt !== null)
    return () => document.body.classList.remove('has-install-prompt')
  }, [installPromptEnabled, deferredPrompt])

  // Also gated here, not just on whether the listener attached above — if
  // the setting is switched off while the banner is already showing (e.g.
  // from the Settings modal, which sits on top of everything else), it
  // should disappear immediately rather than linger until dismissed.
  if (!installPromptEnabled || deferredPrompt === null) return null

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
