import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { actionsByScope, useKeybindings } from './useKeybindings'

// @testing-library/react's auto-cleanup needs a global `afterEach`, which
// this project doesn't enable (no `test.globals: true` in vite.config.ts) —
// without this, DOM from one test leaks into the next.
afterEach(() => cleanup())

const STORAGE_KEY = 'seshat:keybindings:v1'

/** Renders the live resolved key for one action, plus buttons exercising every mutator — a thin, inspectable wrapper around the hook. */
const Harness = ({ actionId }: { readonly actionId: string }) => {
  const { key, overrides, setBinding, resetBinding, resetAll, replaceAll, conflictFor } = useKeybindings()
  return (
    <div>
      <span data-testid="key">{key(actionId)}</span>
      <span data-testid="override-count">{Object.keys(overrides).length}</span>
      <button onClick={() => setBinding(actionId, 'Q')}>set-q</button>
      <button onClick={() => resetBinding(actionId)}>reset-one</button>
      <button onClick={() => resetAll()}>reset-all</button>
      <button onClick={() => replaceAll({ [actionId]: 'Z' })}>replace-all</button>
      <span data-testid="dont-know-vs-know">{conflictFor('flashcards.dontKnow', 'flashcards', '2')?.id ?? ''}</span>
    </div>
  )
}

describe('useKeybindings', () => {
  beforeEach(() => {
    window.localStorage.clear()
    // `useKeybindings`'s state is a module-level singleton (not per-render),
    // so a previous test's remap otherwise leaks into the next one within
    // this file — reset it for real via the hook's own `resetAll`, not just
    // by clearing localStorage (which the singleton has already read past).
    render(<Harness actionId="flashcards.flip" />)
    act(() => screen.getByText('reset-all').click())
    cleanup()
  })

  it('resolves the registry default when there is no override', () => {
    render(<Harness actionId="flashcards.flip" />)
    expect(screen.getByTestId('key')).toHaveTextContent('Space')
  })

  it('setBinding applies immediately and persists to localStorage', () => {
    render(<Harness actionId="flashcards.flip" />)
    act(() => screen.getByText('set-q').click())

    expect(screen.getByTestId('key')).toHaveTextContent('Q')
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({ 'flashcards.flip': 'Q' })
  })

  it('resetBinding reverts a single action to its default', () => {
    render(<Harness actionId="flashcards.flip" />)
    act(() => screen.getByText('set-q').click())
    expect(screen.getByTestId('key')).toHaveTextContent('Q')

    act(() => screen.getByText('reset-one').click())
    expect(screen.getByTestId('key')).toHaveTextContent('Space')
  })

  it('resetAll clears every override', () => {
    render(<Harness actionId="flashcards.flip" />)
    act(() => screen.getByText('set-q').click())
    expect(screen.getByTestId('override-count')).toHaveTextContent('1')

    act(() => screen.getByText('reset-all').click())
    expect(screen.getByTestId('override-count')).toHaveTextContent('0')
    expect(screen.getByTestId('key')).toHaveTextContent('Space')
  })

  it('replaceAll swaps in a whole new override map', () => {
    render(<Harness actionId="flashcards.flip" />)
    act(() => screen.getByText('set-q').click())
    act(() => screen.getByText('replace-all').click())

    expect(screen.getByTestId('key')).toHaveTextContent('Z')
    expect(screen.getByTestId('override-count')).toHaveTextContent('1')
  })

  it('conflictFor finds another action in the same scope already bound to the candidate key', () => {
    render(<Harness actionId="flashcards.dontKnow" />)
    // flashcards.know defaults to '2' in the 'flashcards' scope.
    expect(screen.getByTestId('dont-know-vs-know')).toHaveTextContent('flashcards.know')
  })

  it('a remap is immediately visible to every mounted consumer, not just the one that made it', () => {
    const TwoConsumers = () => (
      <>
        <div data-testid="first">
          <Harness actionId="flashcards.flip" />
        </div>
        <div data-testid="second">
          <Harness actionId="flashcards.flip" />
        </div>
      </>
    )
    render(<TwoConsumers />)
    const [firstSetButton] = screen.getAllByText('set-q')
    act(() => firstSetButton!.click())

    const keys = screen.getAllByTestId('key')
    expect(keys[0]).toHaveTextContent('Q')
    expect(keys[1]).toHaveTextContent('Q')
  })

  it('every action returned by actionsByScope resolves to a real registered default key', () => {
    const grouped = actionsByScope()
    expect(grouped.size).toBeGreaterThan(0)
    for (const [, actions] of grouped) {
      for (const action of actions) {
        expect(action.defaultKey.length).toBeGreaterThan(0)
      }
    }
  })
})
