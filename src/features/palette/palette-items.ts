import type { StudyCard, StudySet, Theme } from '../../types'

/** The three headings the palette groups its entries under, in display order. */
export const PALETTE_GROUPS = ['Pages', 'Actions', 'Your sets'] as const
export type PaletteGroup = (typeof PALETTE_GROUPS)[number]

/** Things the palette can do that are not a route change; the component maps each to a real handler. */
export type PaletteAction = 'openSettings' | 'openShortcuts' | 'toggleTheme' | 'exportBackup'

export type PaletteTarget =
  { readonly kind: 'route'; readonly to: string } | { readonly kind: 'action'; readonly action: PaletteAction }

export interface PaletteItem {
  readonly id: string
  readonly group: PaletteGroup
  /** The visible text AND the primary fuzzy-search string; unique across the list. */
  readonly label: string
  /** Quiet right-aligned detail (a path, a card count, the current theme). */
  readonly hint?: string
  /** Extra words that also match, so 'new' finds "Create a set" and 'preferences' finds Settings. */
  readonly keywords: readonly string[]
  readonly target: PaletteTarget
}

const route = (id: string, label: string, to: string, keywords: readonly string[]): PaletteItem => ({
  id,
  group: 'Pages',
  label,
  hint: to,
  keywords,
  target: { kind: 'route', to },
})

const PAGE_ITEMS: readonly PaletteItem[] = [
  route('page-home', 'Home', '/', ['dashboard', 'start', 'landing']),
  route('page-sets', 'Sets', '/sets', ['library', 'decks', 'collection', 'all sets']),
  route('page-new', 'Create a set', '/sets/new', ['new', 'add', 'make', 'build', 'deck']),
  route('page-import', 'Import a set', '/sets/import', ['upload', 'file', 'json', 'csv', 'paste']),
  route('page-stats', 'Stats', '/stats', ['statistics', 'progress', 'analytics', 'calibration', 'history']),
  route('page-about', 'About', '/about', ['info', 'author']),
  route('page-docs', 'Docs', '/docs', ['documentation', 'help', 'guide', 'manual']),
  route('page-releases', 'Release notes', '/releases', ['changelog', 'changes', 'whats new', 'version', 'history']),
  route('page-attributions', 'Attributions', '/attributions', ['credits', 'sources', 'citations', 'research']),
  route('page-license', 'License', '/licensing', ['licence', 'legal', 'open source', 'terms']),
]

interface ActionSpec {
  readonly id: string
  readonly label: string
  readonly act: PaletteAction
  readonly keywords: readonly string[]
  readonly hint?: string
}

const action = ({ id, label, act, keywords, hint }: ActionSpec): PaletteItem => ({
  id,
  group: 'Actions',
  label,
  ...(hint === undefined ? {} : { hint }),
  keywords,
  target: { kind: 'action', action: act },
})

const actionItems = (theme: Theme): readonly PaletteItem[] => [
  action({
    id: 'action-settings',
    label: 'Open Settings',
    act: 'openSettings',
    keywords: ['preferences', 'options', 'configure', 'font', 'palette', 'accent'],
  }),
  action({
    id: 'action-shortcuts',
    label: 'Keyboard shortcuts',
    act: 'openShortcuts',
    keywords: ['keys', 'keybindings', 'hotkeys', 'remap'],
  }),
  action({
    id: 'action-theme',
    label: 'Toggle theme',
    act: 'toggleTheme',
    keywords: ['dark', 'light', 'mode', 'appearance', 'system'],
    hint: theme,
  }),
  action({
    id: 'action-backup',
    label: 'Export a backup',
    act: 'exportBackup',
    keywords: ['download', 'save', 'data', 'json', 'export all'],
  }),
]

/** Set names can repeat; the label doubles as cmdk's selection key, so make each one unique. */
const uniqueLabel = (name: string, taken: Map<string, number>): string => {
  const seen = taken.get(name) ?? 0
  taken.set(name, seen + 1)
  return seen === 0 ? name : `${name} (${seen + 1})`
}

const countCards = (cards: readonly StudyCard[]): ReadonlyMap<string, number> =>
  cards.reduce((counts, card) => counts.set(card.setId, (counts.get(card.setId) ?? 0) + 1), new Map<string, number>())

const cardsHint = (count: number): string => `${count} ${count === 1 ? 'card' : 'cards'}`

const setItems = (sets: readonly StudySet[], cards: readonly StudyCard[]): readonly PaletteItem[] => {
  const counts = countCards(cards)
  const taken = new Map<string, number>()
  return sets.flatMap((set): PaletteItem[] => {
    const count = counts.get(set.id) ?? 0
    const name = uniqueLabel(set.name, taken)
    const base = `/sets/${set.id}`
    const open: PaletteItem = {
      id: `set-${set.id}`,
      group: 'Your sets',
      label: name,
      hint: cardsHint(count),
      keywords: ['set', 'open', ...set.tags],
      target: { kind: 'route', to: base },
    }
    // Studying or flipping an empty set has nothing to show, so don't offer it.
    if (count === 0) return [open]
    return [
      open,
      {
        id: `study-${set.id}`,
        group: 'Your sets',
        label: `Study ${name}`,
        keywords: ['review', 'practice', 'learn', ...set.tags],
        target: { kind: 'route', to: `${base}/study` },
      },
      {
        id: `learn-${set.id}`,
        group: 'Your sets',
        label: `Learn ${name}`,
        keywords: ['rounds', 'adaptive', 'multiple choice', 'typed', 'mastery', ...set.tags],
        target: { kind: 'route', to: `${base}/learn` },
      },
      {
        id: `flashcards-${set.id}`,
        group: 'Your sets',
        label: `Flashcards ${name}`,
        keywords: ['cards', 'flip', 'flash', ...set.tags],
        target: { kind: 'route', to: `${base}/flashcards` },
      },
    ]
  })
}

/** Every palette entry for the current data, in display order: pages, actions, then per-set entries. */
export const buildPaletteItems = (
  sets: readonly StudySet[],
  cards: readonly StudyCard[],
  theme: Theme,
): readonly PaletteItem[] => [...PAGE_ITEMS, ...actionItems(theme), ...setItems(sets, cards)]

/** Items bucketed by group, in `PALETTE_GROUPS` order; empty groups are omitted. */
export const groupPaletteItems = (
  items: readonly PaletteItem[],
): readonly { readonly group: PaletteGroup; readonly items: readonly PaletteItem[] }[] =>
  PALETTE_GROUPS.map((group) => ({ group, items: items.filter((item) => item.group === group) })).filter(
    (entry) => entry.items.length > 0,
  )

const THEME_CYCLE: readonly Theme[] = ['system', 'light', 'dark']

/** system -> light -> dark -> system. */
export const nextTheme = (theme: Theme): Theme =>
  THEME_CYCLE[(THEME_CYCLE.indexOf(theme) + 1) % THEME_CYCLE.length] ?? 'system'

/** A binding as shown on a key cap: Ctrl reads as the Command glyph on Apple platforms (matchesBinding accepts either). */
export const paletteKeyHint = (binding: string, isMac: boolean): string =>
  isMac && binding.startsWith('Ctrl+') ? `⌘${binding.slice(5)}` : binding

export const isMacPlatform = (): boolean => typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)
