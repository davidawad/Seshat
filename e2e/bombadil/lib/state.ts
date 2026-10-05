// Extractors: what each captured browser state contributes to the properties and the flows.
import { extract } from '@antithesishq/bombadil'
import { unnamedControls } from './a11y.ts'
import { type Guarded, TID, installGuards, readSetIds, readState, VERDICTS } from './support.ts'

// Elements poking past the viewport (or whose own text overflows their box) that no scroll
// container clips, for triage (only when the page
// overflows, so it costs nothing otherwise).
const overflowCulprits = (doc: Document, win: Window): string[] => {
  if (doc.documentElement.scrollWidth - win.innerWidth <= 1) return []
  const clipped = (el: Element): boolean => {
    for (let p = el.parentElement; p !== null; p = p.parentElement) {
      if (['auto', 'scroll', 'hidden', 'clip'].includes(win.getComputedStyle(p).overflowX)) return true
    }
    return false
  }
  return Array.from(doc.querySelectorAll('body *'))
    .filter(
      (el) =>
        (el.getBoundingClientRect().right > win.innerWidth + 1 || el.scrollWidth > el.clientWidth + 1) && !clipped(el),
    )
    .slice(0, 6)
    .map(
      (el) =>
        `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} right=${Math.round(el.getBoundingClientRect().right)}`,
    )
}

export const page = extract((state) => {
  const win = state.window
  installGuards(win)
  const doc = state.document
  const main = doc.querySelector('main')
  const active = doc.activeElement
  const h1 = main?.querySelector('h1') ?? null
  const long = (win as Guarded).__bombLong ?? { max: 0, count: 0 }
  return {
    pathname: win.location.pathname,
    isHtml: doc.contentType === 'text/html',
    hasHeader: doc.querySelector('header.app-header') !== null,
    hasFooter: doc.querySelector('footer.app-footer') !== null,
    hasMain: main !== null,
    hasH1: h1 !== null,
    overflow: doc.documentElement.scrollWidth - win.innerWidth,
    overflowCulprits: overflowCulprits(doc, win),
    modalOpen: doc.querySelector('dialog[open]') !== null,
    focusOk: h1 !== null && main !== null && (active === h1 || main.contains(active)),
    unnamed: unnamedControls(doc),
    longTaskMs: Math.round(long.max),
    longTasks: long.count,
    present: Array.from(
      new Set(Array.from(doc.querySelectorAll('[data-testid]')).map((e) => e.getAttribute('data-testid') ?? '')),
    ),
    nudge: doc.querySelector(TID('backup-nudge')) !== null,
    learnState: learnState(doc),
    confirmOpen: doc.querySelector(`dialog[open] ${TID('confirm-dialog-cancel')}`) !== null,
    confirmHasBoth:
      doc.querySelector(`dialog[open] ${TID('confirm-dialog-cancel')}`) === null ||
      (doc.querySelector(`dialog[open] ${TID('confirm-dialog-accept')}`) !== null &&
        (doc.querySelector('dialog[open]')?.contains(active) ?? false)),
  }
})

/** What a Learn page is currently showing; 'none' means a dead (blank) Learn page. */
const learnState = (doc: Document): string => {
  if (doc.querySelector(TID('learn-page')) === null && !doc.location.pathname.endsWith('/learn')) return 'n/a'
  const has = (id: string) => doc.querySelector(TID(id)) !== null
  for (const id of [
    'learn-options',
    'learn-answer-input',
    'learn-round-summary',
    'learn-summary',
    'learn-empty',
    'learn-no-text-cards',
    'learn-prompt',
    'learn-stage',
  ]) {
    if (has(id)) return id
  }
  return doc.querySelector('button') !== null && doc.querySelector('main button') !== null ? 'other-button' : 'none'
}

// Cross-reload data-loss check: remember the set ids seen at the end of the previous page load in
// sessionStorage; on a fresh page load, every remembered id must still be in localStorage.
export const reloadLoss = extract((state) => {
  const win = state.window
  installGuards(win)
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

// Verdicts written by the scripted actions below (import yields a set, sample loads, diagram saves
// make cards, cancelling a confirm keeps data, dismissing the backup banner sticks). Read-and-clear.
export const verdicts = extract((state) => {
  const win = state.window
  installGuards(win)
  let failed: string[] = []
  let passed = 0
  try {
    const list = JSON.parse(win.sessionStorage.getItem(VERDICTS) ?? '[]') as {
      kind: string
      ok: boolean
      msg: string
    }[]
    failed = list.filter((v) => !v.ok).map((v) => `${v.kind}: ${v.msg}`)
    passed = list.length - failed.length
    win.sessionStorage.removeItem(VERDICTS)
  } catch {
    // ignore
  }
  return { failed, passed }
})

export const world = extract((state) => {
  const s = readState(state.window)
  return {
    sets: (s.sets ?? []).length,
    cards: (s.cards ?? []).length,
    nudgeDismissed: s.activation?.nudgeDismissedAt != null,
  }
})
