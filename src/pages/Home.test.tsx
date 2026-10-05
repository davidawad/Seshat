import { cleanup, render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearMirrors } from '../lib/persistence'
import { saveState } from '../lib/storage'
import { SeshatProvider } from '../lib/store'
import { createEmptyAppState, setIdSchema } from '../types'
import { HomePage } from './Home'
import { SetsPage } from './Sets'

afterEach(() => cleanup())
beforeEach(() => {
  window.localStorage.clear()
  clearMirrors()
})

const now = new Date().toISOString()

const seed = () =>
  saveState({
    ...createEmptyAppState(),
    sets: [
      {
        id: setIdSchema.parse('a1111111-1111-4111-8111-111111111111'),
        name: 'Anatomy',
        description: '',
        tags: ['bio'],
        createdAt: now,
        updatedAt: now,
        goalDate: null,
      },
    ],
  })

const renderAt = (path: string) =>
  render(
    <SeshatProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/sets/*" element={<SetsPage />} />
        </Routes>
      </MemoryRouter>
    </SeshatProvider>,
  )

/** The page's markup with the h1 text and the generated heading id normalised away. */
const structure = (container: HTMLElement) => {
  const copy = container.cloneNode(true) as HTMLElement
  const heading = copy.querySelector('h1')!
  const title = heading.textContent
  heading.textContent = ''
  const id = heading.id
  return {
    title,
    html: copy.innerHTML
      .split(id)
      .join('HEADING')
      .replace(/name="_r_[0-9a-z]+_"/g, 'name="RADIO"'),
  }
}

describe('Home and Sets pages', () => {
  for (const [label, withSets] of [
    ['empty', false],
    ['with sets', true],
  ] as const) {
    it(`render the same structure apart from the heading (${label})`, () => {
      if (withSets) seed()
      const home = structure(renderAt('/').container)
      cleanup()
      const sets = structure(renderAt('/sets').container)
      expect(home.title).toBe('Your sets')
      expect(sets.title).toBe('Sets')
      expect(home.html).toBe(sets.html)
    })
  }
})
