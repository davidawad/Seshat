import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { clearMirrors } from '../lib/persistence'
import { SeshatProvider } from '../lib/store'
import { TESTIDS } from '../lib/testids'
import { Layout } from './Layout'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
  Element.prototype.scrollIntoView ??= () => undefined
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

beforeEach(() => {
  window.localStorage.clear()
  clearMirrors()
})

afterEach(cleanup)

const mount = () => {
  const router = createMemoryRouter(
    [
      {
        element: <Layout />,
        children: [
          { path: '/a', element: <h1>Page A</h1> },
          { path: '/b', element: <h1>Page B</h1> },
        ],
      },
    ],
    { initialEntries: ['/a', '/b'], initialIndex: 1 },
  )
  render(
    <SeshatProvider>
      <RouterProvider router={router} />
    </SeshatProvider>,
  )
  return router
}

describe('Layout modals and history navigation', () => {
  it.each([
    ['Settings', TESTIDS.settingsOpen, TESTIDS.settingsModal],
    ['Keyboard shortcuts', TESTIDS.shortcutsOpen, TESTIDS.shortcutsModal],
  ])('closes %s on browser Back and focuses the new h1', async (_name, openId, modalId) => {
    const router = mount()
    act(() => screen.getByTestId(openId).click())
    expect(screen.getByTestId(modalId)).toHaveAttribute('open')
    await act(async () => {
      await router.navigate(-1)
    })
    expect(router.state.location.pathname).toBe('/a')
    expect(screen.getByTestId(modalId)).not.toHaveAttribute('open')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Page A' })).toHaveFocus())
  })

  it('closes the command palette on Back', async () => {
    const user = userEvent.setup()
    const router = mount()
    await user.keyboard('{Control>}k{/Control}')
    const palette = await screen.findByTestId(TESTIDS.palette)
    expect(palette).toHaveAttribute('open')
    await act(async () => {
      await router.navigate(-1)
    })
    await waitFor(() => expect(palette).not.toHaveAttribute('open'))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Page A' })).toHaveFocus())
  })

  it('still opens Settings from the palette', async () => {
    const user = userEvent.setup()
    mount()
    await user.keyboard('{Control>}k{/Control}')
    await screen.findByTestId(TESTIDS.palette)
    await user.type(screen.getByTestId(TESTIDS.paletteInput), 'open settings{Enter}')
    expect(await screen.findByTestId(TESTIDS.settingsModal)).toHaveAttribute('open')
    expect(screen.getByTestId(TESTIDS.palette)).not.toHaveAttribute('open')
  })
})
