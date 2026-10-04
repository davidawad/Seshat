import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CardImage } from '../../components/CardImage'
import { MigrationNotice } from '../../components/MigrationNotice'
import { LEGACY_COPY_KEY } from '../../lib/media/migrate'
import { MediaStoreProvider } from '../../lib/media/MediaStoreProvider'
import { setMigrationNotice } from '../../lib/media/migration-notice'
import { createMemoryLegacyStore } from '../../lib/media/legacy-store'
import { createMemoryMediaStore } from '../../lib/media/store'
import { nodeBlob, pngBytes, stateWith, textCard, v1Raw, occlusionCard, dataUrlOf } from '../../lib/media/test-helpers'
import { STORAGE_KEY } from '../../lib/storage'
import { SeshatProvider, useSeshatStore } from '../../lib/store'
import { RestorePreviousField } from './RestorePreviousField'
import { StorageField } from './StorageField'

afterEach(() => {
  cleanup()
  setMigrationNotice(null)
})

beforeEach(() => {
  window.localStorage.clear()
})

describe('StorageField', () => {
  it('shows usage and cleans up, refreshing the readout', async () => {
    const store = createMemoryMediaStore(() => 0) // created at epoch 0: far older than 24h
    await store.put(nodeBlob(pngBytes(1, 2048)), { width: 1, height: 1 })
    render(
      <MediaStoreProvider store={store}>
        <SeshatProvider>
          <StorageField />
        </SeshatProvider>
      </MediaStoreProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('storage-usage')).toHaveTextContent('Images: 1 (2.0 KB)'))
    await userEvent.click(screen.getByTestId('storage-cleanup'))
    await waitFor(() => expect(screen.getByTestId('storage-status')).toHaveTextContent('Removed 1 unused image'))
    expect(screen.getByTestId('storage-usage')).toHaveTextContent('Images: 0 (0 B)')
    await userEvent.click(screen.getByTestId('storage-cleanup'))
    await waitFor(() => expect(screen.getByTestId('storage-status')).toHaveTextContent('No unused images'))
  })

  it('degrades when the image store is unavailable', async () => {
    const broken = {
      ...createMemoryMediaStore(),
      usage: async () => Promise.reject(new Error('no idb')),
      list: async () => Promise.reject(new Error('no idb')),
    }
    render(
      <MediaStoreProvider store={broken}>
        <SeshatProvider>
          <StorageField />
        </SeshatProvider>
      </MediaStoreProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('storage-usage')).toHaveTextContent('not available'))
    expect(screen.getByTestId('storage-cleanup')).toBeDisabled()
  })

  it('reports a failed clean-up without changing anything', async () => {
    const store = createMemoryMediaStore()
    const flaky = {
      ...store,
      list: async () => Promise.reject(new Error('boom')),
      usage: async () => ({ bytes: 0, count: 0 }),
    }
    render(
      <MediaStoreProvider store={flaky}>
        <SeshatProvider>
          <StorageField />
        </SeshatProvider>
      </MediaStoreProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('storage-usage')).toHaveTextContent('Images: 0'))
    await userEvent.click(screen.getByTestId('storage-cleanup'))
    await waitFor(() => expect(screen.getByTestId('storage-status')).toHaveTextContent('Could not clean up'))
  })
})

const CardCount = () => <p data-testid="card-count">{useSeshatStore().state.cards.length}</p>

describe('RestorePreviousField', () => {
  it('is hidden when there is no saved copy', async () => {
    const legacy = createMemoryLegacyStore()
    render(
      <SeshatProvider>
        <RestorePreviousField legacy={legacy} />
      </SeshatProvider>,
    )
    await act(async () => undefined)
    expect(screen.queryByTestId('restore-previous')).toBeNull()
  })

  it('asks first, then restores the pre-migration data into the running app and storage', async () => {
    const legacy = createMemoryLegacyStore()
    await legacy.put(LEGACY_COPY_KEY, v1Raw(stateWith([textCard(1), occlusionCard(2, dataUrlOf(pngBytes(1)))])))
    render(
      <SeshatProvider>
        <RestorePreviousField legacy={legacy} />
        <CardCount />
      </SeshatProvider>,
    )
    await userEvent.click(await screen.findByTestId('restore-previous'))
    expect(screen.getByTestId('restore-confirm')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('restore-confirm-cancel'))
    expect(screen.queryByTestId('restore-confirm')).toBeNull()
    expect(screen.getByTestId('card-count')).toHaveTextContent('0')

    await userEvent.click(screen.getByTestId('restore-previous'))
    await userEvent.click(screen.getByTestId('restore-confirm-yes'))
    await waitFor(() => expect(screen.getByTestId('restore-status')).toHaveTextContent('Restored'))
    expect(screen.getByTestId('card-count')).toHaveTextContent('2')
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('imageDataUrl')
  })

  it('shows an error and changes nothing when the restore fails', async () => {
    const legacy = createMemoryLegacyStore()
    await legacy.put(LEGACY_COPY_KEY, '{not json')
    render(
      <SeshatProvider>
        <RestorePreviousField legacy={legacy} />
        <CardCount />
      </SeshatProvider>,
    )
    await userEvent.click(await screen.findByTestId('restore-previous'))
    await userEvent.click(screen.getByTestId('restore-confirm-yes'))
    expect(await screen.findByRole('alert')).toHaveTextContent('not readable')
    expect(screen.getByTestId('card-count')).toHaveTextContent('0')
  })
})

describe('MigrationNotice', () => {
  it('renders the notice, as an alert for warnings, and can be dismissed', async () => {
    render(<MigrationNotice />)
    expect(screen.queryByTestId('migration-notice')).toBeNull()
    act(() => setMigrationNotice({ tone: 'warning', text: 'could not finish' }))
    expect(screen.getByRole('alert')).toHaveTextContent('could not finish')
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByTestId('migration-notice')).toBeNull()
    act(() => setMigrationNotice({ tone: 'info', text: 'moved 2 images' }))
    expect(screen.getByRole('status')).toHaveTextContent('moved 2 images')
  })
})

describe('CardImage', () => {
  it('prefers a stored ref, falls back to the legacy data URL, else renders nothing', async () => {
    const store = createMemoryMediaStore()
    const ref = await store.put(nodeBlob(pngBytes(1)), { width: 4, height: 3, alt: 'stored' })
    const { container, rerender } = render(
      <MediaStoreProvider store={store}>
        <CardImage image={ref} imageDataUrl="data:image/png;base64,AAAA" alt="x" />
      </MediaStoreProvider>,
    )
    expect(container.querySelector('img[src^="data:"]')).toBeNull()
    rerender(
      <MediaStoreProvider store={store}>
        <CardImage imageDataUrl="data:image/png;base64,AAAA" alt="legacy" className="c" />
      </MediaStoreProvider>,
    )
    expect(screen.getByAltText('legacy')).toHaveAttribute('src', 'data:image/png;base64,AAAA')
    rerender(
      <MediaStoreProvider store={store}>
        <CardImage alt="none" />
      </MediaStoreProvider>,
    )
    expect(container.querySelector('img')).toBeNull()
  })
})
