// Shared helpers for the Bombadil spec: storage reads, the guards that keep the renderer
// responsive, scripted-flow verdicts and small DOM utilities. Pure support, no properties.

export const STORAGE_KEY = 'seshat:app-state:v2'
export const BASE = '/seshat'
export const VERDICTS = 'bombadil:verdicts'
export const TID = (id: string) => `[data-testid="${id}"]`

export interface Stored {
  sets?: { id: string }[]
  cards?: { setId: string; id: string }[]
  activation?: { nudgeDismissedAt?: string | null }
}

export const readState = (win: Window): Stored => {
  try {
    const raw = win.localStorage.getItem(STORAGE_KEY)
    return raw === null ? {} : (JSON.parse(raw) as Stored)
  } catch {
    return {}
  }
}
export const readSetIds = (win: Window): string[] => (readState(win).sets ?? []).map((s) => s.id)

export type Guarded = Window & {
  __bombGuards?: boolean
  __bombLong?: { max: number; count: number }
}

/** Stub everything that can block the renderer; idempotent, re-applied after every reload. */
export const installGuards = (win: Window): void => {
  const w = win as Guarded
  if (w.__bombGuards === true) return
  w.__bombGuards = true
  w.confirm = () => true
  w.alert = () => undefined
  w.prompt = () => null
  w.print = () => undefined
  w.onbeforeunload = null
  w.addEventListener(
    'beforeunload',
    (event) => {
      event.stopImmediatePropagation()
    },
    true,
  )
  // A real file chooser would block; scripted actions set `input.files` themselves.
  const originalClick = w.HTMLInputElement.prototype.click
  const noop = function (this: HTMLInputElement) {
    if (this.type === 'file') return
    originalClick.call(this)
  }
  w.HTMLInputElement.prototype.click = noop
  w.document.addEventListener(
    'click',
    (event) => {
      const t = event.target
      if (t instanceof w.HTMLInputElement && t.type === 'file') event.preventDefault()
    },
    true,
  )
  const picker = w as unknown as Record<string, unknown>
  for (const k of ['showOpenFilePicker', 'showSaveFilePicker', 'showDirectoryPicker']) {
    picker[k] = () => Promise.reject(new DOMException('stubbed by bombadil', 'AbortError'))
  }
  // Long main-thread tasks are the other way Runtime.evaluate times out; record the worst one.
  w.__bombLong = { max: 0, count: 0 }
  try {
    new w.PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const long = w.__bombLong
        if (long === undefined) return
        long.count += 1
        long.max = Math.max(long.max, e.duration)
      }
    }).observe({ type: 'longtask', buffered: true })
  } catch {
    // longtask not supported
  }
}

export const pushVerdict = (win: Window, kind: string, ok: boolean, msg: string): void => {
  try {
    const list = JSON.parse(win.sessionStorage.getItem(VERDICTS) ?? '[]') as unknown[]
    list.push({ kind, ok, msg })
    win.sessionStorage.setItem(VERDICTS, JSON.stringify(list))
  } catch {
    // ignore
  }
}

// Deterministic per-browser-session PRNG (mulberry32 over a counter in sessionStorage). Custom
// action ARGUMENTS must be constant so `--reproduce` can match recorded actions to the generator's
// output; the randomness therefore lives in the handlers, replayed identically from a fresh session.
export const rand = (win: Window): number => {
  let n = 0
  try {
    n = Number(win.sessionStorage.getItem('bombadil:rng') ?? '0') + 1
    win.sessionStorage.setItem('bombadil:rng', String(n))
  } catch {
    n = Math.floor(Math.random() * 1e9)
  }
  let t = (n * 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) % 1_000_000
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const waitFor = async (check: () => boolean, ms = 2500): Promise<boolean> => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (check()) return true
    await sleep(50)
  }
  return check()
}

export const setNativeValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export const clickIfPresent = (document: Document, selector: string): boolean => {
  const el = document.querySelector<HTMLElement>(selector)
  if (el === null || (el as HTMLButtonElement).disabled) return false
  el.click()
  return true
}
