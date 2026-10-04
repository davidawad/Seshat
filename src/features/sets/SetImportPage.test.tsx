import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SeshatProvider, useSeshatStore } from '../../lib/store'
import { SetImportPage } from './SetImportPage'

afterEach(() => cleanup())

const Sets = () => {
  const { state } = useSeshatStore()
  return (
    <ul aria-label="stored sets">
      {state.sets.map((set) => (
        <li key={set.id}>
          {set.name}:{state.cards.filter((card) => card.setId === set.id).length}
        </li>
      ))}
    </ul>
  )
}

const renderPage = () =>
  render(
    <SeshatProvider>
      <MemoryRouter initialEntries={['/sets/import']}>
        <Routes>
          <Route path="/sets/import" element={<SetImportPage />} />
          <Route
            path="/sets/:id"
            element={
              <>
                <p>set hub</p>
                <Sets />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </SeshatProvider>,
  )

const fileOf = (content: string, name = 'set.json') => new File([content], name, { type: 'application/json' })

describe('SetImportPage', () => {
  beforeEach(() => window.localStorage.clear())

  it('shows a live preview of how many cards were parsed', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByTestId('import-preview')).toHaveTextContent('')
    await user.click(screen.getByRole('textbox', { name: 'Paste terms and definitions' }))
    await user.paste('a\tb\nc,d')
    expect(screen.getByTestId('import-preview')).toHaveTextContent('2 cards parsed')
  })

  it('imports pasted text under the given name and opens the new set', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByRole('textbox', { name: 'Set name' }), 'Pasted')
    await user.click(screen.getByRole('textbox', { name: 'Paste terms and definitions' }))
    await user.paste('one\t1\ntwo\t2')
    await user.click(screen.getByRole('button', { name: 'Import' }))
    expect(await screen.findByText('set hub')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'stored sets' })).toHaveTextContent('Pasted:2')
  })

  it('shows alerts for a missing name and for unparseable text', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Import' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a set name.')
    await user.type(screen.getByRole('textbox', { name: 'Set name' }), 'N')
    await user.click(screen.getByRole('button', { name: 'Import' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Paste some term/definition lines')
    await user.type(screen.getByRole('textbox', { name: 'Paste terms and definitions' }), 'no delimiter')
    await user.click(screen.getByRole('button', { name: 'Import' }))
    expect(screen.getByRole('alert')).toHaveTextContent('No lines could be parsed')
  })

  it('imports a plain term/definition json file using the name field', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByRole('textbox', { name: 'Set name' }), 'From file')
    await user.upload(screen.getByTestId('import-file'), fileOf(JSON.stringify([{ term: 'a', definition: 'b' }])))
    expect(await screen.findByTestId('import-file-name')).toHaveTextContent('set.json')
    await user.click(screen.getByRole('button', { name: 'Import' }))
    expect(await screen.findByText('set hub')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'stored sets' })).toHaveTextContent('From file:1')
  })

  it('reports bad files and lets the file be removed', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.upload(screen.getByTestId('import-file'), fileOf('{nope'))
    await user.click(screen.getByRole('button', { name: 'Import' }))
    expect(screen.getByRole('alert')).toHaveTextContent('not valid JSON')
    await user.click(screen.getByRole('button', { name: 'Remove file' }))
    expect(screen.queryByTestId('import-file-name')).toBeNull()
  })

  it('accepts a dropped file', async () => {
    const user = userEvent.setup()
    renderPage()
    const zone = screen.getByTestId('import-dropzone')
    fireEvent.dragOver(zone)
    expect(zone).toHaveClass('is-dragging')
    fireEvent.drop(zone, { dataTransfer: { files: [fileOf('[{"term":"x","definition":"y"}]', 'drop.json')] } })
    await waitFor(() => expect(screen.getByTestId('import-file-name')).toHaveTextContent('drop.json'))
    expect(zone).not.toHaveClass('is-dragging')
    await user.type(screen.getByRole('textbox', { name: 'Set name' }), 'Dropped')
    await user.click(screen.getByRole('button', { name: 'Import' }))
    expect(await screen.findByText('set hub')).toBeInTheDocument()
  })
})
