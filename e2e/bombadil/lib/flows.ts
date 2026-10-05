// Scripted flows: custom actions that drive the deep features and assert their own outcome
// through pushVerdict. Arguments are constants (randomness comes from `rand` inside handlers).
import { actions } from '@antithesishq/bombadil'
import { registerCustomAction } from '@antithesishq/bombadil/browser'
import { isVisible } from './a11y.ts'
import { page, world } from './state.ts'
import {
  BASE,
  TID,
  clickIfPresent,
  installGuards,
  pushVerdict,
  rand,
  readSetIds,
  readState,
  setNativeValue,
  sleep,
  waitFor,
} from './support.ts'

// ---------------------------------------------------------------------------------------------
// Scripted flows (custom actions). Each is idempotent-ish and self-checking via pushVerdict.
// ---------------------------------------------------------------------------------------------

const IMPORT_FORMS = [
  (seed: number) => ({
    name: 'valid.json',
    type: 'application/json',
    body: JSON.stringify({
      name: `Bombadil json ${seed}`,
      terms: [
        { term: `t${seed}a`, definition: 'first' },
        { term: `t${seed}b`, definition: 'second' },
      ],
    }),
  }),
  (seed: number) => ({
    name: 'valid.csv',
    type: 'text/csv',
    body: `term,definition\ncsv${seed}a,one\ncsv${seed}b,two\n`,
  }),
  (seed: number) => ({
    name: 'valid.tsv',
    type: 'text/tab-separated-values',
    body: `tsv${seed}a\tone\ntsv${seed}b\ttwo\n`,
  }),
  (seed: number) => ({ name: 'valid.txt', type: 'text/plain', body: `txt${seed}a\tone\ntxt${seed}b\ttwo\n` }),
]

const importValid = registerCustomAction('importValid', async (document, window) => {
  installGuards(window)
  const seed = rand(window)
  const form = rand(window)
  const input = document.querySelector<HTMLInputElement>('input[type=file]')
  const submit = document.querySelector<HTMLButtonElement>(TID('import-paste-submit'))
  if (input === null || submit === null) return
  const spec = IMPORT_FORMS[form % IMPORT_FORMS.length](seed)
  const before = readSetIds(window).length
  const dt = new DataTransfer()
  dt.items.add(new File([spec.body], spec.name, { type: spec.type }))
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await sleep(250)
  submit.click()
  const ok = await waitFor(() => readSetIds(window).length > before, 4000)
  pushVerdict(window, 'import', ok, `valid ${spec.name} did not yield a set (${before} sets)`)
})

const loadSample = registerCustomAction('loadSample', async (document, window) => {
  installGuards(window)
  const before = readSetIds(window).length
  if (!clickIfPresent(document, TID('sets-browser-sample-load'))) return
  const ok = await waitFor(() => readSetIds(window).length > before, 3000)
  pushVerdict(window, 'sample', ok, 'loading the sample did not add a set')
})

const dismissBackupNudge = registerCustomAction('dismissBackupNudge', async (document, window) => {
  installGuards(window)
  if (!clickIfPresent(document, TID('backup-nudge-dismiss'))) return
  const gone = await waitFor(() => document.querySelector(TID('backup-nudge')) === null, 2000)
  pushVerdict(window, 'nudge-dismiss', gone, 'backup banner still shown after Dismiss')
  await sleep(200)
  const stays = document.querySelector(TID('backup-nudge')) === null
  pushVerdict(window, 'nudge-stays-dismissed', stays, 'backup banner reappeared right after dismissal')
})

// Delete confirmations are two actions so the open dialog is observable between them (the
// confirmDialogWellFormed property needs a captured state with it open). `openConfirm` records what
// the target owns; `resolveConfirm` cancels (button or Escape) and asserts nothing was removed, or
// accepts and asserts the target is gone. Ids are compared, not counts: other actions keep running.
const CONFIRM = 'bombadil:confirm'
interface PendingConfirm {
  readonly kind: 'set' | 'card'
  readonly setId: string
  readonly before: string[]
  readonly path: string
  readonly at: number
}

const ownedIds = (window: Window, setId: string): string[] => [
  ...(readSetIds(window).includes(setId) ? [setId] : []),
  ...(readState(window).cards ?? []).filter((c) => c.setId === setId).map((c) => c.id),
]

const openConfirm = registerCustomAction('openConfirm', async (document, window) => {
  installGuards(window)
  const cardTrigger = document.querySelector<HTMLElement>(TID('edit-card-delete'))
  const trigger = cardTrigger ?? document.querySelector<HTMLElement>(TID('edit-delete-set'))
  if (trigger === null) return
  const setId = window.location.pathname.split('/')[3] ?? ''
  const pending: PendingConfirm = {
    kind: cardTrigger === null ? 'set' : 'card',
    setId,
    before: ownedIds(window, setId),
    path: window.location.pathname,
    at: Date.now(),
  }
  window.sessionStorage.setItem(CONFIRM, JSON.stringify(pending))
  trigger.click()
  const opened = await waitFor(
    () => document.querySelector(`dialog[open] ${TID('confirm-dialog-cancel')}`) !== null,
    1500,
  )
  pushVerdict(window, 'confirm-opens', opened, 'a delete button did not open the confirm dialog')
})

const resolveConfirm = registerCustomAction('resolveConfirm', async (document, window) => {
  installGuards(window)
  const how = rand(window) % 3
  const raw = window.sessionStorage.getItem(CONFIRM)
  const dialog = document.querySelector<HTMLDialogElement>('dialog[open]')
  if (dialog === null) return
  const inside = dialog.contains(document.activeElement)
  pushVerdict(window, 'confirm-focus', inside, 'focus not inside the open confirm dialog')
  window.sessionStorage.removeItem(CONFIRM)
  if (how === 2) document.querySelector<HTMLElement>(TID('confirm-dialog-accept'))?.click()
  else if (how === 1) {
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
    dialog.close()
  } else document.querySelector<HTMLElement>(TID('confirm-dialog-cancel'))?.click()
  await waitFor(() => document.querySelector('dialog[open]') === null, 1500)
  if (raw === null) return
  const pending = JSON.parse(raw) as PendingConfirm
  // A dialog opened by an ordinary click (not openConfirm) has no matching record: do not judge it.
  if (pending.path !== window.location.pathname || Date.now() - pending.at > 5000) return
  if (how === 2) {
    const gone = () =>
      pending.kind === 'set'
        ? !readSetIds(window).includes(pending.setId)
        : pending.before.some((id) => !ownedIds(window, pending.setId).includes(id))
    pushVerdict(window, 'confirm-accept', await waitFor(gone, 2000), `accepting did not remove the ${pending.kind}`)
    return
  }
  const after = ownedIds(window, pending.setId)
  const lost = pending.before.filter((id) => !after.includes(id))
  pushVerdict(window, 'confirm-cancel', lost.length === 0, `cancelling a delete removed ${lost.join(',')}`)
})

const makePng = (window: Window, seed: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const canvas = window.document.createElement('canvas')
    canvas.width = 240
    canvas.height = 160
    const ctx = canvas.getContext('2d')
    if (ctx === null) return reject(new Error('no 2d context'))
    ctx.fillStyle = `hsl(${seed % 360}, 60%, 80%)`
    ctx.fillRect(0, 0, 240, 160)
    ctx.fillStyle = '#123'
    ctx.fillRect(30 + (seed % 60), 30, 80, 60)
    canvas.toBlob((b) => (b === null ? reject(new Error('toBlob failed')) : resolve(b)), 'image/png')
  })

const attachImage = async (document: Document, window: Window, scope: ParentNode, seed: number): Promise<boolean> => {
  const input = scope.querySelector<HTMLInputElement>('input[type=file][accept^="image"]')
  if (input === null) return false
  const blob = await makePng(window, seed)
  const dt = new DataTransfer()
  dt.items.add(new File([blob], 'bombadil.png', { type: 'image/png' }))
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return waitFor(
    () =>
      scope.querySelector(TID('image-slot-thumb')) !== null || document.querySelector(TID('image-slot-thumb')) !== null,
    4000,
  )
}

// One step of building and saving a labeled diagram on the set edit page.
const diagramStep = registerCustomAction('diagramStep', async (document, window) => {
  installGuards(window)
  const seed = rand(window)
  const editor = document.querySelector<HTMLElement>(TID('diagram-editor'))
  if (editor === null) {
    if (!clickIfPresent(document, TID('edit-add-diagram'))) return
    await waitFor(() => document.querySelector(TID('diagram-editor')) !== null, 4000)
    return
  }
  const setId = window.location.pathname.split('/')[3] ?? ''
  const title = editor.querySelector<HTMLInputElement>('input[type=text]')
  if (title !== null && title.value.trim() === '') setNativeValue(title, `Diagram ${seed}`)
  if (editor.querySelector(TID('image-slot-thumb')) === null) {
    const ok = await attachImage(document, window, editor, seed)
    pushVerdict(window, 'diagram-image', ok, 'a valid PNG did not attach to the diagram editor')
    return
  }
  const alt = editor.querySelector<HTMLInputElement>(TID('image-slot-alt'))
  if (alt !== null && alt.value.trim() === '') setNativeValue(alt, 'A test diagram')
  while (editor.querySelectorAll(TID('diagram-region-label')).length < 1 + (seed % 3)) {
    const n = editor.querySelectorAll(TID('diagram-region-label')).length
    if (!clickIfPresent(document, TID('diagram-add-region'))) break
    await waitFor(() => editor.querySelectorAll(TID('diagram-region-label')).length > n, 1500)
  }
  const labels = Array.from(editor.querySelectorAll<HTMLInputElement>(TID('diagram-region-label')))
  labels.forEach((input, i) => {
    if (input.value.trim() === '') setNativeValue(input, `Part ${seed}-${i}`)
  })
  await sleep(100)
  // New diagram: one card per label. Existing diagram: the footer announces "(adds A, updates U,
  // removes R)"; removals open a confirmation instead of saving, so only assert when R is 0.
  const summary = editor.querySelector(TID('diagram-card-count'))?.textContent ?? ''
  const change = /adds (\d+), updates (\d+), removes (\d+)/.exec(summary)
  const expected = change === null ? labels.length : Number(change[1])
  const removes = change === null ? 0 : Number(change[3])
  const cardsBefore = (readState(window).cards ?? []).filter((c) => c.setId === setId).length
  if (!clickIfPresent(document, TID('diagram-save')) || removes > 0) return
  const saved = await waitFor(
    () => (readState(window).cards ?? []).filter((c) => c.setId === setId).length >= cardsBefore + expected,
    4000,
  )
  const stillOpen = document.querySelector(TID('diagram-editor')) !== null
  pushVerdict(
    window,
    'diagram-save',
    saved,
    `saving a diagram (${summary}) did not add ${expected} cards (editor ${stillOpen ? 'still open' : 'closed'})`,
  )
})

// One step of a Learn session: answer, reveal-continue, next round, restart.
const learnStep = registerCustomAction('learnStep', async (document, window) => {
  installGuards(window)
  const seed = rand(window)
  const options = Array.from(document.querySelectorAll<HTMLElement>(TID('learn-option'))).filter(
    (b) => !(b as HTMLButtonElement).disabled,
  )
  const input = document.querySelector<HTMLInputElement>(TID('learn-answer-input'))
  if (options.length > 0) {
    options[seed % options.length].click()
  } else if (input !== null) {
    if (seed % 5 === 0) clickIfPresent(document, TID('learn-dont-know'))
    else {
      setNativeValue(input, `guess ${seed}`)
      await sleep(50)
      clickIfPresent(document, TID('learn-check'))
    }
  } else if (!clickIfPresent(document, TID('learn-next-round'))) {
    const main = document.querySelector('main')
    const cont = Array.from(main?.querySelectorAll<HTMLButtonElement>('button') ?? []).find((b) =>
      /^(continue|next)/i.test((b.textContent ?? '').trim()),
    )
    if (cont !== undefined) cont.click()
    else if (seed % 4 === 0) clickIfPresent(document, TID('learn-restart'))
    else clickIfPresent(document, TID('learn-finish'))
  }
})

// Guided navigation so random exploration reaches the deep pages quickly.
const clickRandom = registerCustomAction('clickRandom', async (document, window, selector: string) => {
  installGuards(window)
  const seed = rand(window)
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(isVisible)
  if (els.length === 0) return
  els[seed % els.length].click()
})

// Typing without CDP key events: Bombadil's own TypeText/PressKey ran right before several browser
// wedges (see spec.ts header), so keyboard-ish input is simulated inside the page instead. The
// strings include long unbroken runs, emoji and RTL text, which is what finds overflow bugs.
const NASTY = [
  'x'.repeat(120),
  'Ünïcödé ŝtrïng wíth áccents',
  '🙂'.repeat(40),
  'שלום עולם '.repeat(8),
  'https://example.com/' + 'a'.repeat(90),
  '<b>not html</b> & "quotes" \'single\'',
  ' ',
  '',
  '0',
]

const TEXT_INPUTS = 'input:not([type]), input[type=text], input[type=search], input[type=url], textarea'

const typeRandom = registerCustomAction('typeRandom', async (document, window) => {
  installGuards(window)
  const seed = rand(window)
  const active = document.activeElement
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(TEXT_INPUTS)).filter(
    isVisible,
  )
  const target =
    active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      ? active
      : inputs[seed % Math.max(1, inputs.length)]
  if (target === undefined || target.readOnly || target.disabled) return
  setNativeValue(target, NASTY[seed % NASTY.length])
})

// Enter / Escape without CDP key events: submit the focused field's form, press a focused button,
// or dismiss an open dialog the way the browser does (cancel event, then close).
const keyJab = registerCustomAction('keyJab', async (document, window) => {
  installGuards(window)
  const seed = rand(window)
  const dialog = document.querySelector<HTMLDialogElement>('dialog[open]')
  if (seed % 2 === 0 && dialog !== null) {
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }))
    dialog.close()
    return
  }
  const active = document.activeElement
  const key = seed % 2 === 0 ? 'Escape' : 'Enter'
  const init = { key, code: key, bubbles: true, cancelable: true }
  active?.dispatchEvent(new KeyboardEvent('keydown', init))
  active?.dispatchEvent(new KeyboardEvent('keyup', init))
  if (key === 'Enter' && active instanceof HTMLInputElement) active.form?.requestSubmit()
  else if (key === 'Enter' && active instanceof HTMLButtonElement) active.click()
})

const fillCreateForm = registerCustomAction('fillCreateForm', async (document, window) => {
  installGuards(window)
  const seed = rand(window)
  const title = document.querySelector<HTMLInputElement>(TID('create-title'))
  if (title === null) return
  setNativeValue(title, `Created ${seed}`)
  const terms = Array.from(document.querySelectorAll<HTMLInputElement>(TID('create-term')))
  const defs = Array.from(document.querySelectorAll<HTMLInputElement>(TID('create-definition')))
  terms.forEach((t, i) => setNativeValue(t, `ct${seed}-${i}`))
  defs.forEach((d, i) => setNativeValue(d, `cd${seed}-${i}`))
  await sleep(100)
  const before = readSetIds(window).length
  if (!clickIfPresent(document, TID('create-submit'))) return
  const ok = await waitFor(() => readSetIds(window).length > before, 3000)
  pushVerdict(window, 'create', ok, 'a filled-in create form did not yield a set')
})

const has = (id: string) => page.current.present.includes(id)
const at = (suffix: string) => page.current.pathname.endsWith(suffix)
const inSetsSubpage = (re: RegExp) => re.test(page.current.pathname.replace(BASE, ''))

export const flows = actions(() => {
  const out = [typeRandom(), keyJab()]
  const p = page.current.pathname.replace(BASE, '') || '/'
  const w = world.current
  if (page.current.confirmOpen) {
    out.push(resolveConfirm())
    return out
  }
  if (p === '/sets/import') out.push(importValid())
  if (p === '/sets/new') out.push(fillCreateForm())
  if ((p === '/' || p === '/sets') && w.sets === 0) out.push(loadSample())
  if (p === '/' || p === '/sets') {
    if (has('sets-browser-set-link')) out.push(clickRandom('[data-testid="sets-browser-set-link"]'))
    out.push(clickRandom('[data-testid="sets-browser-hero-import"], [data-testid="sets-browser-import"]'))
    out.push(clickRandom('[data-testid="sets-browser-new-set"], [data-testid="sets-browser-create"]'))
    out.push(clickRandom('[data-testid="sets-browser-view-table"], [data-testid="sets-browser-view-grid"]'))
    if (has('sets-browser-sample-load')) out.push(loadSample())
  }
  if (page.current.nudge) out.push(dismissBackupNudge())
  if (inSetsSubpage(/^\/sets\/[^/]+\/games$/)) out.push(clickRandom('[data-testid^="games-open-"]'))
  if (inSetsSubpage(/^\/sets\/[^/]+$/)) {
    out.push(clickRandom('[data-testid^="set-mode-"], [data-testid="set-edit-link"]'))
    if (has('set-mode-learn')) out.push(clickRandom('[data-testid="set-mode-learn"]'))
  }
  if (inSetsSubpage(/^\/sets\/[^/]+\/edit$/)) {
    out.push(diagramStep(), diagramStep())
    if (has('edit-card-delete') || has('edit-delete-set')) out.push(openConfirm())
  }
  if (at('/learn')) {
    out.push(learnStep())
  }
  if (p === '/stats' || p === '/' || p === '/sets')
    out.push(clickRandom('[data-testid="nav-sets"], [data-testid="nav-stats"]'))
  return out
})
