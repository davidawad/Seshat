import { describe, expect, it } from 'vitest'
import { buildCatalog, categoryOfPath, titleCaseSlug } from './catalog'
import { STARTER_SETS } from './starter-sets'

const simple = (name: string) => JSON.stringify({ name, terms: [{ term: 'a', definition: 'b' }] })
const full = (name: string) =>
  JSON.stringify({
    seshatExportVersion: 1,
    name,
    description: 'Full one',
    tags: [],
    cards: [
      {
        prompt: 'Q',
        content: { kind: 'short-answer', answer: 'A', acceptableAnswers: [] },
        explanation: null,
        sourceRef: null,
        tags: [],
      },
    ],
  })
const src = (text: string) => () => Promise.resolve(text)
const P = './sample-data/catalog'

describe('catalog helpers', () => {
  it('derives category from the directory and title-cases slugs', () => {
    expect(categoryOfPath(`${P}/law/x.json`)).toBe('law')
    expect(categoryOfPath(`${P}/x.json`)).toBe('other')
    expect(titleCaseSlug('patent-bar_prep')).toBe('Patent Bar Prep')
  })
})

describe('buildCatalog', () => {
  it('parses both formats and groups by category with labels from categories.json', async () => {
    const catalog = await buildCatalog(
      { [`${P}/law/a.json`]: src(simple('Alpha')), [`${P}/science/b.json`]: src(full('Beta')) },
      src(JSON.stringify({ law: { label: 'Law School', blurb: 'Legal terms' } })),
    )
    const alpha = catalog.entries.find((e) => e.name === 'Alpha')
    expect(alpha).toMatchObject({ category: 'law', cardCount: 1 })
    expect(catalog.entries.find((e) => e.name === 'Beta')).toMatchObject({
      category: 'science',
      description: 'Full one',
    })
    expect(catalog.categories.find((c) => c.slug === 'law')).toMatchObject({
      label: 'Law School',
      blurb: 'Legal terms',
    })
    expect(catalog.categories.find((c) => c.slug === 'science')?.label).toBe('Science')
    expect(catalog.errors).toEqual([])
  })

  it('skips a malformed file and surfaces the error', async () => {
    const catalog = await buildCatalog({ [`${P}/law/bad.json`]: src('{nope'), [`${P}/law/ok.json`]: src(simple('Ok')) })
    expect(catalog.entries.some((e) => e.name === 'Ok')).toBe(true)
    expect(catalog.errors).toHaveLength(1)
    expect(catalog.errors[0]?.path).toContain('bad.json')
  })

  it('surfaces a loader that rejects', async () => {
    const catalog = await buildCatalog({ [`${P}/x/a.json`]: () => Promise.reject(new Error('boom')) })
    expect(catalog.errors[0]?.message).toBe('boom')
  })

  it('includes starter sets, and a catalog file of the same name replaces the starter', async () => {
    const starter = STARTER_SETS[0]!
    const without = await buildCatalog({})
    expect(without.entries.some((e) => e.id === `starter:${starter.id}`)).toBe(true)
    const moved = await buildCatalog({ [`${P}/general/moved.json`]: src(simple(starter.set.name)) })
    expect(moved.entries.filter((e) => e.name === starter.set.name)).toHaveLength(1)
    expect(moved.entries.find((e) => e.name === starter.set.name)?.id).toContain('moved.json')
  })

  it('reports a bad categories.json but still builds', async () => {
    const catalog = await buildCatalog({ [`${P}/a/x.json`]: src(simple('X')) }, src('[1'))
    expect(catalog.errors.some((e) => e.path === 'categories.json')).toBe(true)
    expect(catalog.categories.some((c) => c.slug === 'a')).toBe(true)
  })
})
