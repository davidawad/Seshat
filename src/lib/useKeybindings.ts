import { useCallback, useSyncExternalStore } from 'react'
import {
  KEYBINDING_REGISTRY,
  type KeybindingAction,
  type KeybindingOverrides,
  type KeybindingScope,
  canonicalizeKeyString,
  findBindingConflict,
  resolveKeybindings,
} from './keybindings'
import { loadKeybindingOverrides, saveKeybindingOverrides } from './keybindingStorage'

/**
 * Module-level store (not React context) so every consumer across the app —
 * regardless of where it sits in the tree — reads the same live keymap and
 * re-renders the instant a remap happens, with no provider to wire up.
 * Mirrors the `subscribe`/`getSnapshot` shape `useSyncExternalStore` expects.
 */

interface Snapshot {
  readonly keys: Readonly<Record<string, string>>
  readonly overrides: KeybindingOverrides
}

let overrides: KeybindingOverrides = loadKeybindingOverrides()
let snapshot: Snapshot = { keys: resolveKeybindings(overrides), overrides }

type Listener = () => void
const listeners = new Set<Listener>()

const commit = (next: KeybindingOverrides): void => {
  overrides = next
  snapshot = { keys: resolveKeybindings(overrides), overrides }
  saveKeybindingOverrides(overrides)
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = (): Snapshot => snapshot

export interface UseKeybindingsResult {
  /** action id -> effective (resolved) key string, for every registered action. */
  readonly keys: Readonly<Record<string, string>>
  /** The raw override map — only entries that differ from the registry default. */
  readonly overrides: KeybindingOverrides
  /** The effective key for one action id (registry default unless overridden). */
  readonly key: (actionId: string) => string
  /** Another action in `scope` already bound to `candidateKey` (excluding `actionId` itself), or `null`. Call before `setBinding` to decide whether to confirm/refuse a conflicting remap. */
  readonly conflictFor: (actionId: string, scope: KeybindingScope, candidateKey: string) => KeybindingAction | null
  /** Applies a new binding for one action, canonicalizing it first (a no-op if `key` doesn't canonicalize — see `canonicalizeKeyString`). Does not itself check for conflicts — callers that care (the remap UI) should call `conflictFor` first. */
  readonly setBinding: (actionId: string, key: string) => void
  /** Reverts one action to its registry default. */
  readonly resetBinding: (actionId: string) => void
  /** Reverts every action to its registry default. */
  readonly resetAll: () => void
  /** Replaces the entire override map at once (e.g. after a validated JSON upload). */
  readonly replaceAll: (nextOverrides: KeybindingOverrides) => void
}

export const useKeybindings = (): UseKeybindingsResult => {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const key = useCallback((actionId: string) => snap.keys[actionId] ?? '', [snap])

  const conflictFor = useCallback(
    (actionId: string, scope: KeybindingScope, candidateKey: string) =>
      findBindingConflict(actionId, scope, candidateKey, snap.keys),
    [snap],
  )

  const setBinding = useCallback((actionId: string, nextKey: string) => {
    // Every real caller (the remap UI) already passes an already-canonical
    // `describeKeyEvent` result — canonicalizing again here is a defensive
    // backstop so `setBinding` can never put a non-canonical string into
    // storage that a live keypress could never match (the same invariant
    // `sanitizeOverrides` enforces for uploaded JSON).
    const canonical = canonicalizeKeyString(nextKey)
    if (canonical === null) return
    commit({ ...overrides, [actionId]: canonical })
  }, [])

  const resetBinding = useCallback((actionId: string) => {
    if (!(actionId in overrides)) return
    const next = { ...overrides }
    delete next[actionId]
    commit(next)
  }, [])

  const resetAll = useCallback(() => {
    commit({})
  }, [])

  const replaceAll = useCallback((nextOverrides: KeybindingOverrides) => {
    commit(nextOverrides)
  }, [])

  return {
    keys: snap.keys,
    overrides: snap.overrides,
    key,
    conflictFor,
    setBinding,
    resetBinding,
    resetAll,
    replaceAll,
  }
}

/** Every registered action, grouped by scope, in registry order — what the remap UI iterates over. */
export const actionsByScope = (): ReadonlyMap<KeybindingScope, readonly KeybindingAction[]> => {
  const grouped = new Map<KeybindingScope, KeybindingAction[]>()
  for (const action of KEYBINDING_REGISTRY) {
    const bucket = grouped.get(action.scope)
    if (bucket === undefined) grouped.set(action.scope, [action])
    else bucket.push(action)
  }
  return grouped
}
