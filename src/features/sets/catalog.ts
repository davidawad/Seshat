import type { ExportedSet } from '../../types'
import { parseImportFile } from './file-import'
import { STARTER_SETS } from './starter-sets'

/**
 * The bundled "Browse sets" catalog. Files live in `sample-data/catalog/<category>/*.json`
 * (simple `{name, terms}` or a full Seshat export); the directory name is the category and
 * `sample-data/catalog/categories.json` (`{"<slug>": {"label","blurb"}}`) supplies labels.
 * Files are discovered with a LAZY glob, so no set text is in the entry bundle: it is
 * fetched as a separate chunk only when the catalog is opened.
 */

export interface CatalogEntry {
  /** Stable key: the file path, or `starter:<id>`. */
  readonly id: string
  readonly category: string
  readonly name: string
  readonly description: string
  readonly cardCount: number
  readonly set: ExportedSet
}

export interface CatalogCategory {
  readonly slug: string
  readonly label: string
  readonly blurb: string
  readonly count: number
}

export interface CatalogError {
  readonly path: string
  readonly message: string
}

export interface Catalog {
  readonly entries: readonly CatalogEntry[]
  readonly categories: readonly CatalogCategory[]
  readonly errors: readonly CatalogError[]
}

export type RawSources = Readonly<Record<string, () => Promise<string>>>

const CATEGORIES_FILE = 'categories.json'
const FALLBACK_CATEGORY = 'other'

/** "patent-bar" or "patent_bar" becomes "Patent Bar". */
export const titleCaseSlug = (slug: string): string =>
  slug
    .split(/[-_\s]+/)
    .filter((word) => word.length > 0)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')

/** The category is the first directory under `catalog/`; a file directly in it is "other". */
export const categoryOfPath = (path: string): string => {
  const parts = path.replace(/^.*?sample-data\/catalog\//, '').split('/')
  return parts.length > 1 && parts[0] !== undefined && parts[0] !== '' ? parts[0] : FALLBACK_CATEGORY
}

interface CategoryMeta {
  readonly label?: string
  readonly blurb?: string
}

const parseCategoryMeta = (raw: string | null, errors: CatalogError[]): Readonly<Record<string, CategoryMeta>> => {
  if (raw === null) return {}
  try {
    const json: unknown = JSON.parse(raw)
    if (typeof json !== 'object' || json === null || Array.isArray(json)) throw new Error('expected an object')
    return Object.fromEntries(
      Object.entries(json).flatMap(([slug, value]): [string, CategoryMeta][] => {
        if (typeof value !== 'object' || value === null) return []
        const { label, blurb } = value as Record<string, unknown>
        return [
          [
            slug,
            {
              ...(typeof label === 'string' ? { label } : {}),
              ...(typeof blurb === 'string' ? { blurb } : {}),
            },
          ],
        ]
      }),
    )
  } catch (error) {
    errors.push({
      path: CATEGORIES_FILE,
      message: `Could not read categories.json: ${error instanceof Error ? error.message : 'invalid'}`,
    })
    return {}
  }
}

const nameKey = (name: string): string => name.trim().toLowerCase()

const entryOf = (id: string, category: string, set: ExportedSet): CatalogEntry => ({
  id,
  category,
  name: set.name,
  description: set.description,
  cardCount: set.cards.length,
  set,
})

const STARTER_CATEGORY: Readonly<Record<string, string>> = {
  'learning-science': 'general',
  'patent-bar-terms': 'patent-bar',
  'mpep-chapters': 'patent-bar',
}

const starterEntries = (): readonly CatalogEntry[] =>
  STARTER_SETS.map((starter) =>
    entryOf(`starter:${starter.id}`, STARTER_CATEGORY[starter.id] ?? FALLBACK_CATEGORY, starter.set),
  )

/**
 * Builds the catalog from raw file loaders. A malformed file is skipped and reported in
 * `errors`; starter sets are merged in, and a catalog file with the same set name wins so
 * moving a starter file into the catalog never duplicates it.
 */
export const buildCatalog = async (files: RawSources, categoriesLoader?: () => Promise<string>): Promise<Catalog> => {
  const errors: CatalogError[] = []
  const settled = await Promise.all(
    Object.entries(files)
      .filter(([path]) => !path.endsWith(`/${CATEGORIES_FILE}`))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(async ([path, load]): Promise<CatalogEntry | null> => {
        try {
          const parsed = parseImportFile(await load(), '')
          if (!parsed.ok) {
            errors.push({ path, message: parsed.error })
            return null
          }
          return entryOf(path, categoryOfPath(path), parsed.value)
        } catch (error) {
          errors.push({ path, message: error instanceof Error ? error.message : 'Could not load the file.' })
          return null
        }
      }),
  )
  const fromFiles = settled.filter((entry): entry is CatalogEntry => entry !== null)
  const taken = new Set(fromFiles.map((entry) => nameKey(entry.name)))
  const entries = [...fromFiles, ...starterEntries().filter((entry) => !taken.has(nameKey(entry.name)))]

  const meta = parseCategoryMeta(
    categoriesLoader === undefined ? null : await categoriesLoader().catch(() => null),
    errors,
  )
  const slugs = [...new Set(entries.map((entry) => entry.category))].sort((a, b) => a.localeCompare(b))
  const categories = slugs.map((slug): CatalogCategory => ({
    slug,
    label: meta[slug]?.label ?? titleCaseSlug(slug),
    blurb: meta[slug]?.blurb ?? '',
    count: entries.filter((entry) => entry.category === slug).length,
  }))
  return { entries, categories, errors }
}

// Lazy on purpose (no `eager`): each set is its own chunk, fetched on demand.
const setFiles = import.meta.glob(['./sample-data/catalog/**/*.json', '!./sample-data/catalog/categories.json'], {
  query: '?raw',
  import: 'default',
}) as RawSources
const categoryFiles = import.meta.glob('./sample-data/catalog/categories.json', {
  query: '?raw',
  import: 'default',
}) as RawSources

let cached: Promise<Catalog> | null = null

/** The real catalog, loaded once per page load. */
export const loadCatalog = (): Promise<Catalog> => {
  cached ??= buildCatalog(setFiles, Object.values(categoryFiles)[0])
  return cached
}
