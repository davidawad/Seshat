import { z } from 'zod'

/**
 * Central registry of every keyboard-triggerable action in the app: a flat
 * list of stable action id -> { defaultKey, label, scope }. `scope` groups
 * actions by where they're active (e.g. a study session's confidence step
 * vs. its reveal step, which are never shown at once) so two actions that
 * can never fire at the same time may safely share a physical key, while two
 * actions active *simultaneously* within the same scope may not —
 * `findRegistryDefaultCollisions` enforces that defensively for the
 * registry's own defaults (see keybindings.test.ts), and
 * `findBindingConflict` enforces the same rule for a user's remap attempt.
 *
 * Keys are canonical strings produced by `describeKeyEvent` (e.g. '1',
 * 'Space', 'ArrowRight', 'Ctrl+Enter') — see there for the exact format.
 */

export type KeybindingScope =
  | 'global'
  | 'flashcards'
  | 'studyAnswer'
  | 'studyConfidence'
  | 'studyReveal'
  | 'match'
  | 'test'
  | 'setDetail'
  | 'games'
  | 'blast'
  | 'blocksQuestion'
  | 'blocksPlacing'

export interface KeybindingAction {
  readonly id: string
  readonly defaultKey: string
  readonly label: string
  readonly scope: KeybindingScope
}

/** Builds `count` numbered sibling actions (option-select, tile-select, etc.), keyed '1'..'count'. */
const numberedActions = (
  idPrefix: string,
  scope: KeybindingScope,
  count: number,
  labelPrefix: string,
): KeybindingAction[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${idPrefix}${index + 1}`,
    defaultKey: String(index + 1),
    label: `${labelPrefix} ${index + 1}`,
    scope,
  }))

export const KEYBINDING_REGISTRY: readonly KeybindingAction[] = [
  // Global — available anywhere in the app shell.
  { id: 'global.openSettings', defaultKey: '?', label: 'Open settings', scope: 'global' },

  // Flashcards session (features/flashcards/FlashcardSession.tsx) plus the
  // order toggle on the page that hosts it (pages/Flashcards.tsx) — grouped
  // in one scope since both are only ever active while viewing flashcards.
  { id: 'flashcards.flip', defaultKey: 'Space', label: 'Flip card', scope: 'flashcards' },
  { id: 'flashcards.dontKnow', defaultKey: '1', label: "Grade: Don't know (once flipped)", scope: 'flashcards' },
  { id: 'flashcards.know', defaultKey: '2', label: 'Grade: Know (once flipped)', scope: 'flashcards' },
  { id: 'flashcards.toggleOrder', defaultKey: 'o', label: 'Toggle shuffled / original order', scope: 'flashcards' },

  // Study session (features/study/ReviewSession.tsx) — one scope per step,
  // since the answer/confidence/reveal steps are mutually exclusive (only
  // one is ever on screen), so they may safely reuse '1'-'4' across steps.
  ...numberedActions('studyAnswer.mcqOption', 'studyAnswer', 4, 'Select MCQ option'),
  { id: 'studyConfidence.guessed', defaultKey: '1', label: 'Confidence: Guessed', scope: 'studyConfidence' },
  { id: 'studyConfidence.unsure', defaultKey: '2', label: 'Confidence: Unsure', scope: 'studyConfidence' },
  { id: 'studyConfidence.sure', defaultKey: '3', label: 'Confidence: Sure', scope: 'studyConfidence' },
  { id: 'studyReveal.again', defaultKey: '1', label: 'Grade: Again', scope: 'studyReveal' },
  { id: 'studyReveal.hard', defaultKey: '2', label: 'Grade: Hard', scope: 'studyReveal' },
  { id: 'studyReveal.good', defaultKey: '3', label: 'Grade: Good', scope: 'studyReveal' },
  { id: 'studyReveal.easy', defaultKey: '4', label: 'Grade: Easy', scope: 'studyReveal' },

  // Match (features/match/MatchSession.tsx) — direct tile select by grid
  // position. Only covers the first 9 tiles (a plain digit key can't address
  // a 16-tile round) — larger rounds fall back to click/tap past tile 9; see
  // the implementation report for why arrow-key roving focus was skipped.
  ...numberedActions('match.selectTile', 'match', 9, 'Select tile'),

  // Test mode (features/test-mode/TestSession.tsx). Deliberately not plain
  // Enter — this is a single page of text/radio inputs, and plain Enter
  // inside a text field must keep doing whatever the browser default is
  // (form submission would fire prematurely on the first field).
  { id: 'test.submit', defaultKey: 'Ctrl+Enter', label: 'Submit test', scope: 'test' },

  // Set detail page (features/sets/SetDetail.tsx) — jump straight to a mode.
  { id: 'setDetail.mode1', defaultKey: '1', label: 'Jump to mode 1 (Study)', scope: 'setDetail' },
  { id: 'setDetail.mode2', defaultKey: '2', label: 'Jump to mode 2 (Flashcards)', scope: 'setDetail' },
  { id: 'setDetail.mode3', defaultKey: '3', label: 'Jump to mode 3 (Test)', scope: 'setDetail' },
  { id: 'setDetail.mode4', defaultKey: '4', label: 'Jump to mode 4 (Games)', scope: 'setDetail' },

  // Games list page (pages/Games.tsx `GamesListPage`) — jump to a game.
  ...numberedActions('games.select', 'games', 5, 'Jump to game'),

  // Blast (features/games/blast/BlastSession.tsx) — select an asteroid option.
  ...numberedActions('blast.selectOption', 'blast', 4, 'Select asteroid option'),

  // Blocks (features/games/blocks/BlocksSession.tsx) — separate scopes for
  // its two mutually-exclusive phases (answer a question, then place the
  // earned block), same reasoning as Study's per-step scopes above.
  ...numberedActions('blocksQuestion.selectOption', 'blocksQuestion', 4, 'Select answer option'),
  ...numberedActions('blocksPlacing.column', 'blocksPlacing', 6, 'Drop in column'),
]

const REGISTRY_BY_ID = new Map(KEYBINDING_REGISTRY.map((action) => [action.id, action]))

// ---------------------------------------------------------------------------
// Key-string canonicalization — the single format both a captured keydown
// event and a hand-typed/uploaded override string are normalized into, so
// they can be compared with plain string equality everywhere else.
// ---------------------------------------------------------------------------

const NAMED_KEY_OVERRIDES: Readonly<Record<string, string>> = { ' ': 'Space' }

const normalizeKeyName = (key: string): string => {
  const named = NAMED_KEY_OVERRIDES[key]
  if (named !== undefined) return named
  if (key.length === 1) return /[a-z0-9]/i.test(key) ? key.toUpperCase() : key
  // Multi-character keys (Enter, Escape, ArrowLeft, Tab, ...) already arrive
  // from KeyboardEvent.key in their canonical capitalization.
  return key
}

/** Only letters/digits and named multi-char keys change meaning when Shift is held — punctuation keys (e.g. '?' from Shift+/) already encode it in `key` itself, so Shift would be redundant (and wouldn't match a plain '?' default). */
const shiftIsMeaningful = (key: string): boolean => (key.length === 1 ? /[a-z0-9]/i.test(key) : true)

/**
 * Produces the canonical binding string for a live keydown event, e.g.
 * '1', 'Space', 'ArrowRight', 'Ctrl+Enter', 'Shift+A'. Modifier order is
 * always Ctrl, Meta, Alt, Shift — fixed so the same physical chord always
 * serializes identically regardless of press order.
 */
export const describeKeyEvent = (
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
): string => {
  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.metaKey) parts.push('Meta')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey && shiftIsMeaningful(event.key)) parts.push('Shift')
  parts.push(normalizeKeyName(event.key))
  return parts.join('+')
}

const MODIFIER_ORDER = ['Ctrl', 'Meta', 'Alt', 'Shift'] as const
type ModifierName = (typeof MODIFIER_ORDER)[number]

const MODIFIER_ALIASES: Readonly<Record<string, ModifierName>> = {
  ctrl: 'Ctrl',
  control: 'Ctrl',
  meta: 'Meta',
  cmd: 'Meta',
  command: 'Meta',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
}

/**
 * Canonicalizes a hand-typed or uploaded key string (e.g. `"ctrl+enter"`,
 * `"  Space "`) into the same format `describeKeyEvent` produces. Returns
 * `null` if the string is empty or contains an unrecognized modifier token —
 * callers treat that as "reject this entry" rather than guessing.
 */
export const canonicalizeKeyString = (raw: string): string | null => {
  const tokens = raw
    .trim()
    .split('+')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
  if (tokens.length === 0) return null

  const keyToken = tokens[tokens.length - 1]!
  const modifierTokens = tokens.slice(0, -1)

  const modifiers = new Set<ModifierName>()
  for (const token of modifierTokens) {
    const canonical = MODIFIER_ALIASES[token.toLowerCase()]
    if (canonical === undefined) return null
    modifiers.add(canonical)
  }

  const keyName =
    keyToken.toLowerCase() === 'space'
      ? 'Space'
      : keyToken.length === 1
        ? normalizeKeyName(keyToken)
        : // Multi-char named keys (Enter, Escape, ArrowLeft, ...): capitalize
          // just the first letter, matching what KeyboardEvent.key would have
          // given us for a correctly-cased input (e.g. "enter" -> "Enter").
          // A key typed in mixed/odd casing (e.g. "arrowleft") won't be fully
          // corrected — an accepted limitation for hand-typed/uploaded JSON.
          keyToken.charAt(0).toUpperCase() + keyToken.slice(1)
  const orderedModifiers = MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier))
  return [...orderedModifiers, keyName].join('+')
}

/** Ctrl and Meta swapped in a canonical binding string; any other string is returned unchanged. */
const swapCtrlMeta = (value: string): string => {
  if (value.startsWith('Ctrl+')) return `Meta+${value.slice(5)}`
  if (value.startsWith('Meta+')) return `Ctrl+${value.slice(5)}`
  return value
}

/**
 * Whether a live keydown event matches a stored (already-canonical) binding
 * string. Treats Ctrl and Meta (Cmd) as interchangeable on the modifier
 * side — this app has exactly one modifier-chord binding (`test.submit`,
 * default `Ctrl+Enter`), meant as the standard cross-platform "primary
 * modifier + Enter" submit convention (Ctrl on Windows/Linux, Cmd on Mac),
 * not a literal physical-key requirement. `describeKeyEvent` itself still
 * records/serializes the literal modifier that was actually pressed (so
 * canonicalization, display, and conflict-detection all stay exact); only
 * the runtime match here is forgiving about which of the two a given OS
 * actually uses for "primary".
 */
export const matchesBinding = (binding: string, event: KeyboardEvent): boolean => {
  const pressed = describeKeyEvent(event)
  return pressed === binding || swapCtrlMeta(pressed) === binding
}

// ---------------------------------------------------------------------------
// Default + override resolution
// ---------------------------------------------------------------------------

/** action id -> user override key string (already canonicalized). Only entries that differ from the registry default need to be present. */
export type KeybindingOverrides = Readonly<Record<string, string>>

// `z.unknown()` values (not `z.string()`) deliberately — a malformed
// individual entry (e.g. a number where a key string was expected) should
// be dropped and reported by `sanitizeOverrides` below, not fail the whole
// upload just because one entry has the wrong shape.
export const keybindingOverridesSchema = z.record(z.string(), z.unknown())

/** The effective key for one action: the override if set, else the registry default. `''` if the action id isn't registered. */
export const resolveKey = (actionId: string, overrides: KeybindingOverrides): string => {
  const override = overrides[actionId]
  if (override !== undefined && override.trim().length > 0) return override
  return REGISTRY_BY_ID.get(actionId)?.defaultKey ?? ''
}

/** Resolves every registered action's effective key at once: action id -> key string. */
export const resolveKeybindings = (overrides: KeybindingOverrides): Record<string, string> => {
  const resolved: Record<string, string> = {}
  for (const action of KEYBINDING_REGISTRY) {
    resolved[action.id] = resolveKey(action.id, overrides)
  }
  return resolved
}

/**
 * Finds another action in `scope` whose *currently resolved* key equals
 * `key` (per `resolved`), excluding `excludingActionId` itself — or `null`
 * if there's no conflict. Used both by the remap UI (before applying a
 * user's new binding) and by the registry's own self-check.
 */
export const findBindingConflict = (
  excludingActionId: string,
  scope: KeybindingScope,
  key: string,
  resolved: Readonly<Record<string, string>>,
): KeybindingAction | null => {
  for (const action of KEYBINDING_REGISTRY) {
    if (action.id === excludingActionId) continue
    if (action.scope !== scope) continue
    if (resolved[action.id] === key) return action
  }
  return null
}

/**
 * Defensive self-check that no two registry *defaults* collide within the
 * same scope — see keybindings.test.ts. A collision here is a bug in this
 * file, not something a user can trigger.
 */
export const findRegistryDefaultCollisions = (): readonly (readonly [KeybindingAction, KeybindingAction])[] => {
  const collisions: (readonly [KeybindingAction, KeybindingAction])[] = []
  for (let i = 0; i < KEYBINDING_REGISTRY.length; i++) {
    for (let j = i + 1; j < KEYBINDING_REGISTRY.length; j++) {
      const a = KEYBINDING_REGISTRY[i]!
      const b = KEYBINDING_REGISTRY[j]!
      if (a.scope === b.scope && a.defaultKey === b.defaultKey) collisions.push([a, b])
    }
  }
  return collisions
}

// ---------------------------------------------------------------------------
// Upload/parse-don't-trust sanitization for a hand-typed or uploaded override JSON blob
// ---------------------------------------------------------------------------

export interface SanitizeOverridesResult {
  readonly overrides: KeybindingOverrides
  /** Action ids present in the input that were dropped: unknown action id, unparseable key string, or still colliding with another action in the same scope once every structurally-valid entry in the upload is applied together. */
  readonly ignoredActionIds: readonly string[]
}

/**
 * Validates+normalizes an arbitrary parsed-JSON value into a safe override
 * map: unknown action ids are dropped, unparseable key strings are dropped.
 * Conflict-checking happens against the FINAL proposed state (every
 * structurally-valid entry applied at once), not by walking entries one at a
 * time — a one-at-a-time walk would falsely reject a same-upload key SWAP
 * between two actions (e.g. `{a: 'the key b currently has', b: 'the key a
 * currently has'}`), since a's new key collides with b's *old* key at the
 * moment a is checked, even though the swap is entirely self-consistent once
 * both sides land. If two actions in the same scope still collide after
 * applying everything together (a genuine conflict, not a swap), ALL of
 * that colliding group's entries are dropped rather than picking an
 * arbitrary "winner" — the user's upload gets those actions back at their
 * defaults instead of a silently-guessed resolution. Never throws — an
 * invalid or malicious upload just yields fewer accepted entries, reported
 * back via `ignoredActionIds`.
 */
export const sanitizeOverrides = (raw: unknown): SanitizeOverridesResult => {
  const parsed = keybindingOverridesSchema.safeParse(raw)
  if (!parsed.success) return { overrides: {}, ignoredActionIds: [] }

  const candidates: Record<string, string> = {}
  const structurallyInvalid: string[] = []

  for (const action of KEYBINDING_REGISTRY) {
    const rawKey = parsed.data[action.id]
    if (rawKey === undefined) continue
    if (typeof rawKey !== 'string') {
      structurallyInvalid.push(action.id)
      continue
    }
    const canonical = canonicalizeKeyString(rawKey)
    if (canonical === null) {
      structurallyInvalid.push(action.id)
      continue
    }
    candidates[action.id] = canonical
  }

  const finalResolved = resolveKeybindings(candidates)
  const accepted: Record<string, string> = {}
  const conflicted: string[] = []
  for (const actionId of Object.keys(candidates)) {
    const action = REGISTRY_BY_ID.get(actionId)!
    const key = finalResolved[actionId]!
    if (findBindingConflict(actionId, action.scope, key, finalResolved) !== null) {
      conflicted.push(actionId)
    } else {
      accepted[actionId] = candidates[actionId]!
    }
  }

  const unknownActionIds = Object.keys(parsed.data).filter((id) => !REGISTRY_BY_ID.has(id))

  return { overrides: accepted, ignoredActionIds: [...structurallyInvalid, ...conflicted, ...unknownActionIds] }
}
