import { z } from 'zod'
import { readLocal, writeLocal } from './persistence'

/** One JSON array of dismissed tip ids; ephemeral UI state, so it lives outside AppState like keybindings do. */
export const TIP_DISMISSED_KEY = 'seshat:tip-dismissed:v1'

const idsSchema = z.array(z.string().max(64)).max(64)

const load = (): ReadonlySet<string> => {
  const raw = readLocal(TIP_DISMISSED_KEY)
  if (raw === null) return new Set()
  try {
    const parsed = idsSchema.safeParse(JSON.parse(raw))
    return new Set(parsed.success ? parsed.data : [])
  } catch {
    return new Set()
  }
}

// Session-wide copy: authoritative even when storage is unavailable or full.
let current: ReadonlySet<string> | null = null
const listeners = new Set<() => void>()

const state = (): ReadonlySet<string> => {
  current ??= load()
  return current
}

const commit = (next: ReadonlySet<string>): void => {
  current = next
  // Result ignored: losing the flag across visits is harmless.
  writeLocal(TIP_DISMISSED_KEY, JSON.stringify([...next]))
  listeners.forEach((listener) => listener())
}

export const isTipDismissed = (id: string): boolean => state().has(id)

export const dismissTip = (id: string): void => {
  if (!state().has(id)) commit(new Set([...state(), id]))
}

/** Brings every tip back (used when the "Show card tips" setting is turned on again). */
export const resetDismissedTips = (): void => {
  if (state().size > 0) commit(new Set())
}

export const subscribeTipDismissals = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test seam: forget the in-memory copy so the next read re-parses storage. */
export const forgetTipCacheForTests = (): void => {
  current = null
}
