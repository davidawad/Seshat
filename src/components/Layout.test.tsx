import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { recordSetAdded } from '../lib/activation'
import { clearMirrors } from '../lib/persistence'
import { STORAGE_KEY } from '../lib/storage'
import { SeshatProvider } from '../lib/store'
import { TESTIDS } from '../lib/testids'
import { type AppState, createEmptyAppState } from '../types'
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

describe('Layout backup nudge', () => {
  const seed = (patch: (state: AppState) => AppState) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(patch(createEmptyAppState())))
  }
  const withRealSet = (state: AppState): AppState => ({
    ...state,
    activation: recordSetAdded(state.activation, 'create', new Date().toISOString()),
  })

  it('is hidden on a fresh install and after only the sample set', () => {
    mountLayout()
    expect(screen.queryByTestId(TESTIDS.backupNudge)).toBeNull()
    cleanup()
    seed((state) => ({ ...state, activation: recordSetAdded(state.activation, 'sample', new Date().toISOString()) }))
    mountLayout()
    expect(screen.queryByTestId(TESTIDS.backupNudge)).toBeNull()
  })

  it('shows after a real set, with the device-only message, and the button opens Settings', () => {
    seed(withRealSet)
    mountLayout()
    expect(screen.getByTestId(TESTIDS.backupNudge)).toHaveTextContent('Your cards are saved on this device only.')
    expect(screen.getByTestId(TESTIDS.settingsModal)).not.toHaveAttribute('open')
    act(() => screen.getByTestId(TESTIDS.backupNudgeDownload).click())
    expect(screen.getByTestId(TESTIDS.settingsModal)).toHaveAttribute('open')
  })

  it('dismissing hides it and keeps it hidden after a reload', () => {
    seed(withRealSet)
    mountLayout()
    act(() => screen.getByTestId(TESTIDS.backupNudgeDismiss).click())
    expect(screen.queryByTestId(TESTIDS.backupNudge)).toBeNull()
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}').activation.nudgeDismissedAt).not.toBeNull()
    cleanup()
    mountLayout()
    expect(screen.queryByTestId(TESTIDS.backupNudge)).toBeNull()
  })

  it('stays hidden when the Show backup reminders setting is off', () => {
    seed((state) => ({ ...withRealSet(state), settings: { ...state.settings, backupRemindersEnabled: false } }))
    mountLayout()
    expect(screen.queryByTestId(TESTIDS.backupNudge)).toBeNull()
  })

  it('returns once 50 reviews have passed since a dismissal', () => {
    seed((state) => ({
      ...state,
      activation: {
        ...withRealSet(state).activation,
        nudgeDismissedAt: new Date().toISOString(),
        reviewsAtNudgeDismissal: 0,
        totalReviews: 50,
      },
    }))
    mountLayout()
    expect(screen.getByTestId(TESTIDS.backupNudge)).toBeInTheDocument()
  })

  it('makes no network request', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    seed(withRealSet)
    mountLayout()
    act(() => screen.getByTestId(TESTIDS.backupNudgeDismiss).click())
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('Layout footer', () => {
  it('links to Thoth as a plain external link after License', () => {
    mountLayout()
    const link = screen.getByTestId(TESTIDS.footerThoth)
    expect(link).toHaveTextContent('Thoth (read)')
    expect(link).toHaveAttribute('href', 'https://davidawad.gitlab.io/thoth/')
    expect(link).toHaveClass('app-footer-link')
    expect(screen.getByTestId(TESTIDS.footerLicense).compareDocumentPosition(link)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })
})
