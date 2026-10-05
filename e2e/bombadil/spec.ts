// Bombadil specification for Seshat: property-based exploration of the built app.
// Run via `just bombadil`. Only ever point this at the local preview server.
import { always, actions, eventually, extract, now, next } from '@antithesishq/bombadil'
import { registerCustomAction } from '@antithesishq/bombadil/browser'
export * from '@antithesishq/bombadil/browser/defaults'

const STORAGE_KEY = 'seshat:app-state:v2'
const BASE = '/seshat'

const readSetIds = (win: Window): string[] => {
  try {
    const raw = win.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []
    const parsed = JSON.parse(raw) as { sets?: { id: string }[] }
    return (parsed.sets ?? []).map((s) => s.id)
  } catch {
    return []
  }
}

const page = extract((state) => {
  const win = state.window
  // A native confirm() blocks CDP Runtime.evaluate and hangs Bombadil (observed twice); auto-accept it.
  win.confirm = () => true
  const doc = state.document
  const main = doc.querySelector('main')
  const active = doc.activeElement
  const h1 = main?.querySelector('h1') ?? null
  return {
    pathname: win.location.pathname,
    isHtml: doc.contentType === 'text/html',
    hasHeader: doc.querySelector('header.app-header') !== null,
    hasFooter: doc.querySelector('footer.app-footer') !== null,
    hasMain: main !== null,
    hasH1: h1 !== null,
    overflow: doc.documentElement.scrollWidth - win.innerWidth,
    modalOpen: doc.querySelector('dialog[open]') !== null,
    focusOk: h1 !== null && main !== null && (active === h1 || main.contains(active)),
  }
})

// Cross-reload data-loss check: remember the set ids seen at the end of the previous page load in
// sessionStorage; on a fresh page load, every remembered id must still be in localStorage.
const reloadLoss = extract((state) => {
  const win = state.window
  const loadId = String(win.performance.timeOrigin)
  const ids = readSetIds(win)
  let lost: string[] = []
  try {
    const prevLoad = win.sessionStorage.getItem('bombadil:loadId')
    const prevIds = JSON.parse(win.sessionStorage.getItem('bombadil:ids') ?? '[]') as string[]
    if (prevLoad !== null && prevLoad !== loadId) lost = prevIds.filter((id) => !ids.includes(id))
    win.sessionStorage.setItem('bombadil:loadId', loadId)
    win.sessionStorage.setItem('bombadil:ids', JSON.stringify(ids))
  } catch {
    // storage unavailable
  }
  return { lost }
})

const importMarker = extract((state) => {
  const win = state.window
  let pending: { before: number; name: string } | null = null
  try {
    const raw = win.sessionStorage.getItem('bombadil:import')
    if (raw !== null) pending = JSON.parse(raw)
  } catch {
    // ignore
  }
  return { pending, count: readSetIds(win).length }
})

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
export const focusLandsOnH1AfterNavigation = always(
  now(() => {
    const before = page.current.pathname
    return next(() => page.current.pathname === before || page.current.modalOpen).or(
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

export const validJsonImportYieldsSet = always(
  now(() => importMarker.current.pending !== null).implies(
    eventually(() => {
      const m = importMarker.current
      return m.pending === null || m.count > m.pending.before
    }).within(5, 'seconds'),
  ),
)

const importValidJson = registerCustomAction('importValidJson', async (document, window, seed: number) => {
  const input = document.querySelector<HTMLInputElement>('input[type=file]')
  const submit = document.querySelector<HTMLButtonElement>('[data-testid=import-paste-submit]')
  if (input === null || submit === null) throw new Error('import form not present')
  const name = `Bombadil set ${seed}`
  const body = JSON.stringify({
    name,
    terms: [
      { term: `t${seed}a`, definition: 'first' },
      { term: `t${seed}b`, definition: 'second' },
    ],
  })
  try {
    const raw = window.localStorage.getItem('seshat:app-state:v2')
    const before = raw === null ? 0 : ((JSON.parse(raw) as { sets?: unknown[] }).sets ?? []).length
    window.sessionStorage.setItem('bombadil:import', JSON.stringify({ before, name }))
  } catch {
    // ignore
  }
  const dt = new DataTransfer()
  dt.items.add(new File([body], 'valid.json', { type: 'application/json' }))
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, 150))
  submit.click()
})

const clearPendingImport = registerCustomAction('clearPendingImport', async (_document, window) => {
  try {
    window.sessionStorage.removeItem('bombadil:import')
  } catch {
    // ignore
  }
})

export const importAndVerify = actions(() => {
  const m = importMarker.current
  const out = []
  if (page.current.pathname === `${BASE}/sets/import`) out.push(importValidJson(Math.floor(Math.random() * 1e6)))
  // Once the set count has grown the import is verified; clear the marker.
  if (m.pending !== null && m.count > m.pending.before) out.push(clearPendingImport())
  return out
})
