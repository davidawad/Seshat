import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { type RouteFocusTarget, useRouteFocus } from './routeFocus'

afterEach(() => cleanup())

let showHeading: (() => void) | null = null

const Harness = ({ route, children }: { readonly route: RouteFocusTarget; readonly children?: React.ReactNode }) => {
  const ref = useRef<HTMLElement>(null)
  const [late, setLate] = useState(false)
  showHeading = () => setLate(true)
  useRouteFocus(route, ref)
  return (
    <>
      <input aria-label="outside" />
      <main ref={ref}>
        {late ? <h1>Late page</h1> : null}
        {children}
      </main>
    </>
  )
}

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 220)))

describe('useRouteFocus with a lazily mounted heading', () => {
  it('moves focus to the h1 once it appears after the navigation', async () => {
    const view = render(<Harness route={{ pathname: '/a' }} />)
    view.rerender(<Harness route={{ pathname: '/b' }} />)
    act(() => showHeading!())
    expect(await screen.findByRole('heading', { name: 'Late page' })).toHaveFocus()
  })
})

describe('useRouteFocus navigation kinds', () => {
  it('does nothing on first mount', () => {
    render(
      <Harness route={{ pathname: '/a', key: 'k1', type: 'POP' }}>
        <h1>Page</h1>
      </Harness>,
    )
    expect(document.body).toHaveFocus()
  })

  it('focuses the h1 on a history Back/Forward (POP) to a different page', () => {
    const view = render(
      <Harness route={{ pathname: '/a', key: 'k1', type: 'PUSH' }}>
        <h1>Page</h1>
      </Harness>,
    )
    view.rerender(
      <Harness route={{ pathname: '/b', key: 'k2', type: 'POP' }}>
        <h1>Page</h1>
      </Harness>,
    )
    expect(screen.getByRole('heading', { name: 'Page' })).toHaveFocus()
  })

  it('focuses a POP back to the same pathname under a new history key', () => {
    const view = render(
      <Harness route={{ pathname: '/a', key: 'k1', type: 'PUSH' }}>
        <h1>Page</h1>
      </Harness>,
    )
    view.rerender(
      <Harness route={{ pathname: '/a', key: 'k2', type: 'POP' }}>
        <h1>Page</h1>
      </Harness>,
    )
    expect(screen.getByRole('heading', { name: 'Page' })).toHaveFocus()
  })

  it('ignores a same-page PUSH (search or hash change)', () => {
    const view = render(
      <Harness route={{ pathname: '/a', key: 'k1', type: 'PUSH' }}>
        <h1>Page</h1>
      </Harness>,
    )
    view.rerender(
      <Harness route={{ pathname: '/a', key: 'k2', type: 'PUSH' }}>
        <h1>Page</h1>
      </Harness>,
    )
    expect(document.body).toHaveFocus()
  })

  it('re-claims focus when a redirect swaps the heading it just focused', async () => {
    const view = render(
      <Harness route={{ pathname: '/import', key: 'k1', type: 'PUSH' }}>
        <h1>Import</h1>
      </Harness>,
    )
    view.rerender(
      <Harness route={{ pathname: '/sets/1', key: 'k2', type: 'REPLACE' }}>
        <h1 key="a">Loading</h1>
      </Harness>,
    )
    expect(screen.getByRole('heading', { name: 'Loading' })).toHaveFocus()
    view.rerender(
      <Harness route={{ pathname: '/sets/1', key: 'k2', type: 'REPLACE' }}>
        <h1 key="b">The set</h1>
      </Harness>,
    )
    await flush()
    expect(screen.getByRole('heading', { name: 'The set' })).toHaveFocus()
  })

  it('does not steal focus from a text field', async () => {
    const view = render(
      <Harness route={{ pathname: '/a', key: 'k1', type: 'PUSH' }}>
        <h1>Page</h1>
      </Harness>,
    )
    const input = screen.getByLabelText('outside')
    input.focus()
    view.rerender(
      <Harness route={{ pathname: '/b', key: 'k2', type: 'POP' }}>
        <h1>Page</h1>
      </Harness>,
    )
    await flush()
    expect(input).toHaveFocus()
  })
})

const Probe = () => {
  const ref = useRef<HTMLElement>(null)
  const { pathname, key } = useLocation()
  const type = useNavigationType()
  const navigate = useNavigate()
  useRouteFocus({ pathname, key, type }, ref)
  return (
    <>
      <nav>
        <button type="button" onClick={() => navigate('/two')}>
          go
        </button>
        <button type="button" onClick={() => navigate(-1)}>
          back
        </button>
      </nav>
      <main ref={ref}>
        <Routes>
          <Route path="/" element={<h1>One</h1>} />
          <Route path="/two" element={<h1>Two</h1>} />
        </Routes>
      </main>
    </>
  )
}

describe('useRouteFocus inside a real router', () => {
  it('lands on the h1 after navigating forward and after Back', async () => {
    render(
      <MemoryRouter>
        <Probe />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'go' }))
    expect(screen.getByRole('heading', { name: 'Two' })).toHaveFocus()
    screen.getByRole('button', { name: 'back' }).focus()
    fireEvent.click(screen.getByRole('button', { name: 'back' }))
    await flush()
    expect(screen.getByRole('heading', { name: 'One' })).toHaveFocus()
  })
})
