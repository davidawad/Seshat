import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

  it('names Quizlet and gives three export steps', () => {
    renderPage()
    const guide = screen.getByTestId('import-quizlet-guide')
    expect(guide).toHaveTextContent('Coming from Quizlet?')
    expect(within(guide).getAllByRole('listitem')).toHaveLength(3)
  })

  it('offers .csv/.tsv/.txt uploads and tucks JSON under Advanced / agents', () => {
    renderPage()
    expect(screen.getByTestId('import-dropzone')).toHaveTextContent('.csv, .tsv or .txt')
    const accept = screen.getByTestId('import-file').getAttribute('accept') ?? ''
    for (const extension of ['.csv', '.tsv', '.txt', '.json']) expect(accept).toContain(extension)
    const advanced = screen.getByTestId('import-advanced')
    expect(advanced.tagName).toBe('DETAILS')
    expect(advanced).not.toHaveAttribute('open')
    expect(within(advanced).getByText('Advanced / agents')).toBeInTheDocument()
    expect(within(advanced).getByRole('link', { name: 'agent guide' })).toHaveAttribute(
      'href',
      expect.stringContaining('agents.txt'),
    )
  })

  it('imports a .csv file, suggesting the set name from the file name', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.upload(
      screen.getByTestId('import-file'),
      fileOf('Term,Definition\n"Paris, FR",capital\nx,y', 'world_capitals.csv'),
    )
    expect(await screen.findByTestId('import-file-name')).toHaveTextContent('world_capitals.csv')
    expect(screen.getByRole('textbox', { name: 'Set name' })).toHaveValue('World capitals')
    expect(screen.getByTestId('import-preview')).toHaveTextContent('2 cards parsed from world_capitals.csv')
    await user.click(screen.getByRole('button', { name: 'Import' }))
    expect(await screen.findByText('set hub')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'stored sets' })).toHaveTextContent('World capitals:2')
  })

  it('imports a tab-separated .txt Quizlet export and does not overwrite a typed name', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(screen.getByRole('textbox', { name: 'Set name' }), 'Mine')
    await user.upload(screen.getByTestId('import-file'), fileOf('a\tb\nc\td', 'quizlet.txt'))
    await screen.findByTestId('import-file-name')
    expect(screen.getByRole('textbox', { name: 'Set name' })).toHaveValue('Mine')
    await user.click(screen.getByRole('button', { name: 'Import' }))
    expect(await screen.findByText('set hub')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'stored sets' })).toHaveTextContent('Mine:2')
  })
})
