import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBackup } from '../../lib/backup'
import { clearMirrors } from '../../lib/persistence'
import { SeshatProvider, useSeshatStore } from '../../lib/store'
import { createEmptyAppState } from '../../types'
import { BackupField } from './BackupField'

afterEach(() => cleanup())

const downloadJsonMock = vi.fn<(filename: string, data: unknown) => void>()
vi.mock('../sets/download', () => ({
  downloadJson: (filename: string, data: unknown) => downloadJsonMock(filename, data),
}))

const SetCount = () => <p data-testid="set-count">{useSeshatStore().state.sets.length}</p>
const AddSet = () => {
  const { addSet } = useSeshatStore()
  return <button onClick={() => addSet({ name: 'Existing', description: '', tags: [] })}>add-set</button>
}

const renderField = () =>
  render(
    <SeshatProvider>
      <BackupField />
      <SetCount />
      <AddSet />
    </SeshatProvider>,
  )

const backupWithOneSet = () => {
  const now = new Date()
  const iso = now.toISOString()
  const state = {
    ...createEmptyAppState(),
    sets: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'From file',
        description: '',
        tags: [],
        createdAt: iso,
        updatedAt: iso,
        goalDate: null,
      },
    ],
  }
  return JSON.stringify(createBackup(state as never, {}, now))
}

const fileOf = (text: string) => new File([text], 'backup.json', { type: 'application/json' })

describe('BackupField', () => {
  beforeEach(() => {
    window.localStorage.clear()
    clearMirrors()
    downloadJsonMock.mockClear()
  })

  it('downloads the whole app as one dated JSON file', async () => {
    renderField()
    await userEvent.click(screen.getByRole('button', { name: 'Download all data (JSON)' }))
    expect(downloadJsonMock).toHaveBeenCalledTimes(1)
    const [filename, data] = downloadJsonMock.mock.calls[0] ?? []
    expect(filename).toMatch(/^seshat-backup-\d{4}-\d{2}-\d{2}\.json$/)
    expect(data).toMatchObject({ format: 'seshat-backup', version: 1 })
    expect(screen.getByRole('status')).toHaveTextContent('Downloaded')
  })

  it('merges by default, immediately, and reports counts', async () => {
    renderField()
    await userEvent.upload(screen.getByTestId('backup-file'), fileOf(backupWithOneSet()))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Merged 1 set'))
    expect(screen.getByTestId('set-count')).toHaveTextContent('1')
  })

  it('asks for confirmation before replacing, and cancel changes nothing', async () => {
    renderField()
    await userEvent.click(screen.getByRole('button', { name: 'add-set' }))
    await userEvent.click(screen.getByLabelText(/^Replace/))
    await userEvent.upload(screen.getByTestId('backup-file'), fileOf(backupWithOneSet()))
    expect(await screen.findByRole('group', { name: 'Confirm replace' })).toBeInTheDocument()
    expect(screen.getByTestId('set-count')).toHaveTextContent('1')

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('group', { name: 'Confirm replace' })).toBeNull()
    expect(screen.getByTestId('set-count')).toHaveTextContent('1')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('replaces everything once confirmed', async () => {
    renderField()
    await userEvent.click(screen.getByRole('button', { name: 'add-set' }))
    await userEvent.click(screen.getByLabelText(/^Replace/))
    await userEvent.upload(screen.getByTestId('backup-file'), fileOf(backupWithOneSet()))
    await userEvent.click(await screen.findByRole('button', { name: 'Replace everything' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Replaced everything'))
    expect(screen.getByTestId('set-count')).toHaveTextContent('1')
  })

  it('shows an alert and leaves data alone for a bad file', async () => {
    renderField()
    await userEvent.click(screen.getByRole('button', { name: 'add-set' }))
    await userEvent.upload(screen.getByTestId('backup-file'), fileOf('{"hello":"world"}'))
    expect(await screen.findByRole('alert')).toHaveTextContent('not a Seshat backup')
    expect(screen.getByTestId('set-count')).toHaveTextContent('1')
  })

  it('shows an alert when the file cannot be read', async () => {
    renderField()
    const original = FileReader.prototype.readAsText
    FileReader.prototype.readAsText = function (this: FileReader) {
      this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>)
    }
    try {
      await act(async () => {
        await userEvent.upload(screen.getByTestId('backup-file'), fileOf('{}'))
      })
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not read')
    } finally {
      FileReader.prototype.readAsText = original
    }
  })
})
