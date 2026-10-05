import { act, cleanup, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { useRouteFocus } from './routeFocus'

afterEach(() => cleanup())

let showHeading: (() => void) | null = null

const Harness = ({ path }: { readonly path: string }) => {
  const ref = useRef<HTMLElement>(null)
  const [late, setLate] = useState(false)
  showHeading = () => setLate(true)
  useRouteFocus(path, ref)
  return <main ref={ref}>{late ? <h1>Late page</h1> : null}</main>
}

describe('useRouteFocus with a lazily mounted heading', () => {
  it('moves focus to the h1 once it appears after the navigation', async () => {
    const view = render(<Harness path="/a" />)
    view.rerender(<Harness path="/b" />)
    act(() => showHeading!())
    expect(await screen.findByRole('heading', { name: 'Late page' })).toHaveFocus()
  })
})
