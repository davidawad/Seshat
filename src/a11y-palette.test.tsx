import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installA11yTestEnv, renderAt, seed } from './a11y-fixtures'
import { missingTestIds, unnamedInteractive } from './lib/a11y-audit'
import { TESTIDS } from './lib/testids'

installA11yTestEnv()
vi.setConfig({ testTimeout: 60_000 })

describe('accessibility tree: command palette', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('command palette: named dialog, combobox + listbox + options, stable ids', async () => {
    Element.prototype.scrollIntoView ??= () => undefined
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    const user = userEvent.setup()
    seed()
    const { container } = renderAt('/')
    await user.keyboard('{Control>}k{/Control}')
    const palette = await screen.findByRole('dialog', { name: 'Command menu' })
    expect(unnamedInteractive(palette)).toEqual([])
    expect(within(palette).getByRole('combobox')).toBeInTheDocument()
    expect(within(palette).getByRole('listbox', { name: 'Results' })).toBeInTheDocument()
    const options = within(palette).getAllByRole('option')
    expect(options.length).toBeGreaterThan(10)
    expect(within(palette).getAllByRole('group').length).toBe(3)
    expect(screen.getByTestId(TESTIDS.paletteStatus)).toHaveAttribute('role', 'status')
    expect(
      missingTestIds(container, [TESTIDS.palette, TESTIDS.paletteInput, TESTIDS.paletteList, TESTIDS.paletteItem]),
    ).toEqual([])
  })
})
