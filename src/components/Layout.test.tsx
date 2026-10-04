import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearMirrors } from '../lib/persistence'
import { STORAGE_KEY } from '../lib/storage'
import { SeshatProvider } from '../lib/store'
import { TESTIDS } from '../lib/testids'
import { Layout } from './Layout'

/** setItem that throws only for the app-state key (the availability probe must still pass). */
const failOnState = (error: Error) => (key: string) => {
  if (key === STORAGE_KEY) throw error
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

beforeEach(() => {
  window.localStorage.clear()
  clearMirrors()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const mountLayout = () =>
  render(
    <MemoryRouter>
      <SeshatProvider>
        <Layout />
      </SeshatProvider>
    </MemoryRouter>,
  )

describe('Layout save-error banner', () => {
  it('shows no banner while saves succeed', () => {
    mountLayout()
    expect(screen.queryByTestId(TESTIDS.layoutSaveError)).toBeNull()
  })

  it('shows the quota message with a button that opens Settings', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
      failOnState(new DOMException('full', 'QuotaExceededError')),
    )
    mountLayout()
    const banner = screen.getByRole('alert')
    expect(banner).toHaveAttribute('data-testid', TESTIDS.layoutSaveError)
    expect(banner).toHaveTextContent("Your browser's storage is full: recent changes are NOT saved.")
    expect(screen.getByTestId(TESTIDS.settingsModal)).not.toHaveAttribute('open')
    act(() => screen.getByTestId(TESTIDS.layoutSaveErrorSettings).click())
    expect(screen.getByTestId(TESTIDS.settingsModal)).toHaveAttribute('open')
  })

  it('shows a generic message for other write failures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(failOnState(new Error('boom')))
    mountLayout()
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save')
  })
})
