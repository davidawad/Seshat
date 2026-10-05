// Bombadil specification for Seshat: property-based exploration of the built app.
// Run via `just bombadil` (default 5 x 4 minute runs at 1024x768 then 5 at 390x844). Only ever point
// this at the local preview server (`pnpm run build && pnpm exec vite preview`); never at a
// third-party site.
//
// Stalls ("timed out waiting for response for Runtime.evaluate"), what is known:
//  - A native modal (window.confirm/alert/prompt/print, a beforeunload prompt, a file chooser) blocks
//    the renderer, which CDP Runtime.evaluate needs. The app no longer ships window.confirm (see
//    ConfirmDialog), and `installGuards` stubs all of them (plus the File System Access pickers and
//    clicks on <input type=file>) on every state capture, so exploration cannot open one.
//  - The app itself is not the cause: no long tasks (max observed 705 ms; the
//    noLongMainThreadTask property guards this), no render loop, and routeFocus.ts's
//    MutationObserver only observes childList while its callback sets an attribute and focuses, so
//    it cannot re-trigger itself and disconnects after 3 s.
//  - What still happened, and what stopped it. Bombadil's own CDP calls (Runtime.evaluate, then
//    Debugger.evaluateOnCallFrame) stopped answering, the Chrome 154 browser process spun a core,
//    and Bombadil never reached its --time-limit (the orphaned Chrome kept spinning for hours).
//    It always followed Bombadil's CDP key events (Enter/Escape/typing) or a click on a
//    Study/Learn link, with no native dialog open; the renderer was idle when sampled, and the same
//    key sequences never hang plain Playwright on Chrome 154. Measured, 2026-10-05:
//      JS coverage instrumentation on  + CDP key events: 3 of 19 four-minute runs wedged
//      instrumentation off             + CDP key events: 1 of 14 wedged
//      instrumentation off + keyboard simulated in the page (below): 0 of 32
//    So run.sh passes `--instrument-javascript=` (coverage only steers exploration, not the
//    properties) and this spec replaces Bombadil's `inputs` generator (TypeText/PressKey) with the
//    in-page `typeRandom` and `keyJab` flows (lib/explore.ts, lib/flows.ts). As a backstop run.sh
//    kills the whole process tree when trace.jsonl stops growing and reports the run as wedged, not
//    as a violation, so a wedge costs about 75 s. Upstream report: bead seshat-fde.
//
// --reproduce: unreliable in Bombadil 0.7.8 for this app, and not fixable from the spec. A custom
// action never matches its own recording, even a no-argument one in a trivial spec (verified), and
// even a defaults-only spec diverges on the second action (the recorded action is not in the
// regenerated set). Use `bombadil browser inspect <run dir>` (trace and screenshots) and the action
// log in target/bombadil/<run>.log instead. Action ARGUMENTS here are constants and randomness is a
// per-session deterministic PRNG (`rand`), so a future Bombadil that matches custom actions can
// replay them.
//
// Scripted flows (custom actions) assert their own outcome via `pushVerdict`, surfaced by the
// scriptedFlowsHold property: import of valid JSON/CSV/TSV/TXT yields a set, the sample loads,
// a filled-in create form yields a set, a saved diagram yields one card per label, cancelling a
// delete confirmation (button or Escape) deletes nothing while accepting removes exactly the
// target, and dismissing the backup banner sticks. `typeRandom` types long unbroken strings, emoji
// and RTL text into fields, which is what finds phone-width overflow bugs.
import { always, eventually, now, next } from '@antithesishq/bombadil'
import { page, reloadLoss, verdicts } from './lib/state.ts'
import { BASE } from './lib/support.ts'
export {
  noConsoleErrors,
  noHttpErrorCodes,
  noUncaughtExceptions,
  noUnhandledPromiseRejections,
} from '@antithesishq/bombadil/browser/defaults/properties'
export { flows } from './lib/flows.ts'
export { explore } from './lib/explore.ts'

// Static files (agents.txt, schemas) are served from under BASE too but are not app pages.
const underBase = () => page.current.pathname.startsWith(BASE) && page.current.isHtml

// Right after a reload/back the lazy route chunk is still loading and the shell is not mounted yet,
// so presence is judged within a settling window instead of in every single captured state.
const shellPresent = () => page.current.hasHeader && page.current.hasFooter && page.current.hasMain
export const headerAndFooterAlwaysPresent = always(
  now(() => underBase() && !shellPresent()).implies(
    eventually(() => !underBase() || shellPresent()).within(3, 'seconds'),
  ),
)

export const noHorizontalOverflow = always(() => page.current.overflow <= 1)

// A client-side route change must move focus to the new page's h1 (or leave it inside main).
// Layout closes open modals on navigation, so there is no modal exemption here.
export const focusLandsOnH1AfterNavigation = always(
  now(() => {
    const before = page.current.pathname
    return next(() => page.current.pathname === before).or(
      eventually(() => page.current.focusOk || !page.current.hasH1).within(2, 'seconds'),
    )
  }),
)

// Every in-app URL ends up rendering a page heading (no blank/dead routes).
export const noDeadRoutes = always(
  now(() => underBase() && !page.current.hasH1 && !page.current.modalOpen).implies(
    eventually(() => !underBase() || page.current.hasH1 || page.current.modalOpen).within(3, 'seconds'),
  ),
)

export const noDataLossOnReload = always(() => reloadLoss.current.lost.length === 0)

// Every visible interactive control has an accessible name.
export const everyControlHasAccessibleName = always(
  now(() => underBase() && page.current.unnamed.length > 0).implies(
    // Controls can render a frame before their label; allow a short settle.
    eventually(() => !underBase() || page.current.unnamed.length === 0).within(1, 'seconds'),
  ),
)

// Scripted flows record pass/fail verdicts (see flows below).
export const scriptedFlowsHold = always(() => verdicts.current.failed.length === 0)

// A Learn page always shows a question, a round/final summary, or an explicit empty state.
export const learnPageNeverBlank = always(
  now(() => page.current.learnState === 'none').implies(
    eventually(() => page.current.learnState !== 'none').within(3, 'seconds'),
  ),
)

// An open ConfirmDialog offers both choices and holds focus inside itself.
export const confirmDialogWellFormed = always(
  now(() => page.current.confirmOpen && !page.current.confirmHasBoth).implies(
    eventually(() => !page.current.confirmOpen || page.current.confirmHasBoth).within(1, 'seconds'),
  ),
)

// No single main-thread task over 4s (that is what starves CDP Runtime.evaluate).
export const noLongMainThreadTask = always(() => page.current.longTaskMs < 4000)
