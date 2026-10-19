import { useId, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Legible } from '../../components/Legible'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import type { CatalogEntry } from './catalog'
import { useCatalog } from './useCatalog'
import './browse.css'

const nameKey = (name: string): string => name.trim().toLowerCase()
const cardsLabel = (count: number): string => `${count} ${count === 1 ? 'card' : 'cards'}`

/**
 * `/sets/browse` — the bundled catalog: category chips (`?category=<slug>`, All by default)
 * and a card per set with an "Add to my sets" button. A set counts as added when one with
 * the same name is already in the library, so adding twice offers "Open" instead of a copy.
 */
export const SetBrowsePage = () => {
  const catalog = useCatalog()
  const { state, importSet, prepareSetImport } = useSeshatStore()
  const [params, setParams] = useSearchParams()
  const [failed, setFailed] = useState<Readonly<Record<string, string>>>({})
  const headingId = useId()
  const category = params.get('category') ?? ''

  const owned = new Map(state.sets.map((set) => [nameKey(set.name), set.id]))

  const add = async (entry: CatalogEntry) => {
    if (owned.has(nameKey(entry.name))) return
    const prepared = await prepareSetImport(entry.set)
    if (!prepared.ok) {
      setFailed((current) => ({ ...current, [entry.id]: prepared.error }))
      return
    }
    importSet(prepared.value, 'sample')
  }

  const select = (slug: string) => setParams(slug === '' ? {} : { category: slug }, { replace: true })

  const visible = catalog === null ? [] : catalog.entries.filter((e) => category === '' || e.category === category)

  return (
    <section aria-labelledby={headingId} data-testid={TESTIDS.browsePage} className="browse">
      <p className="page-back">
        <Link to="/sets">Back</Link>
      </p>
      <h1 id={headingId}>Browse sets</h1>
      <Legible as="p">Ready-made sets that ship with Seshat. Add one and it becomes yours to edit and study.</Legible>

      {catalog === null ? (
        <p role="status">Loading sets…</p>
      ) : (
        <>
          <div role="group" aria-label="Filter by category" className="browse-chips" data-testid={TESTIDS.browseChips}>
            {[{ slug: '', label: 'All', count: catalog.entries.length }, ...catalog.categories].map((chip) => (
              <button
                key={chip.slug}
                type="button"
                className="browse-chip"
                aria-pressed={category === chip.slug}
                data-testid={TESTIDS.browseChip}
                onClick={() => select(chip.slug)}
              >
                {chip.label} <span className="browse-chip-count">{chip.count}</span>
              </button>
            ))}
          </div>

          {catalog.errors.length > 0 && (
            <div role="alert" className="browse-errors" data-testid={TESTIDS.browseErrors}>
              <p>Some bundled sets could not be loaded:</p>
              <ul>
                {catalog.errors.map((error) => (
                  <li key={error.path}>
                    <code>{error.path}</code>: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {visible.length === 0 ? (
            <p data-testid={TESTIDS.browseEmpty}>
              {category === '' ? 'No bundled sets are available.' : 'No sets in this category yet.'}
            </p>
          ) : (
            <ul className="browse-grid">
              {visible.map((entry) => {
                const existing = owned.get(nameKey(entry.name))
                return (
                  <li key={entry.id} className="browse-card" data-testid={TESTIDS.browseCard}>
                    <h2 className="browse-card-name">{entry.name}</h2>
                    <p className="browse-card-description">{entry.description || 'No description.'}</p>
                    <p className="browse-card-meta">{cardsLabel(entry.cardCount)}</p>
                    {failed[entry.id] !== undefined && <p role="alert">{failed[entry.id]}</p>}
                    {existing === undefined ? (
                      <button
                        type="button"
                        className="browse-card-action"
                        data-testid={TESTIDS.browseAdd}
                        aria-label={`Add ${entry.name} to my sets`}
                        onClick={() => void add(entry)}
                      >
                        Add to my sets
                      </button>
                    ) : (
                      <p className="browse-card-added">
                        <span role="status">Added</span>{' '}
                        <Link
                          to={`/sets/${existing}`}
                          data-testid={TESTIDS.browseOpen}
                          aria-label={`Open ${entry.name}`}
                        >
                          Open
                        </Link>
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
