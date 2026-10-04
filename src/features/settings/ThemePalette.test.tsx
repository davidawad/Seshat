import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearMirrors } from '../../lib/persistence'
import { SeshatProvider, useSeshatStore } from '../../lib/store'
import { PaletteField } from './PaletteField'
import { ThemeField } from './ThemeField'
import { useApplyTheme } from './theme'

afterEach(() => cleanup())

beforeEach(() => {
  window.localStorage.clear()
  clearMirrors() // settings are also mirrored to a cookie that would otherwise leak between tests
  const root = document.documentElement
  root.removeAttribute('style')
  for (const attribute of ['data-theme', 'data-palette']) root.removeAttribute(attribute)
})

const Harness = () => {
  useApplyTheme()
  const { state, updateSettings } = useSeshatStore()
  return (
    <>
      <ThemeField settings={state.settings} updateSettings={updateSettings} />
      <PaletteField settings={state.settings} updateSettings={updateSettings} />
    </>
  )
}

const mount = () =>
  render(
    <SeshatProvider>
      <Harness />
    </SeshatProvider>,
  )

const rootVar = (name: string): string => document.documentElement.style.getPropertyValue(name)

describe('ThemeField', () => {
  it('exposes Match system / Light / Dark as labeled radios and applies a choice immediately', async () => {
    const user = userEvent.setup()
    mount()
    expect(screen.getByRole('radio', { name: 'Match system' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    expect(document.documentElement.dataset['theme']).toBe('dark')
    await user.click(screen.getByRole('radio', { name: 'Light' }))
    expect(document.documentElement.dataset['theme']).toBe('light')
    await user.click(screen.getByRole('radio', { name: 'Match system' }))
    expect(document.documentElement.dataset['theme']).toBeUndefined()
  })

  it('moves the selection with the arrow keys', async () => {
    const user = userEvent.setup()
    mount()
    screen.getByRole('radio', { name: 'Match system' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked()
    expect(document.documentElement.dataset['theme']).toBe('light')
  })
})

describe('PaletteField', () => {
  it('applies no inline overrides for the default archive palette', () => {
    mount()
    expect(screen.getByRole('radio', { name: /Archive/ })).toBeChecked()
    expect(document.documentElement.getAttribute('style')).not.toContain('--color-bg')
  })

  it('applies a preset as inline variables for the chosen mode', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    await user.click(screen.getByTestId('palette-slate'))
    expect(document.documentElement.dataset['palette']).toBe('slate')
    expect(rootVar('--color-bg')).toBe('#11161d')
    await user.click(screen.getByRole('radio', { name: 'Light' }))
    expect(rootVar('--color-bg')).toBe('#eef2f7')
  })

  it('accepts a readable custom accent and reports its contrast', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    await user.type(screen.getByLabelText('Custom accent hex'), '#ffd54a')
    expect(rootVar('--color-accent')).toBe('#ffd54a')
    expect(rootVar('--color-accent-contrast')).toBe('#000000')
    expect(screen.getByTestId('accent-status')).toHaveTextContent(/applied/)
  })

  it('refuses a low-contrast accent with an inline message', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    await user.type(screen.getByLabelText('Custom accent hex'), '#201a14')
    expect(rootVar('--color-accent')).toBe('')
    expect(screen.getByTestId('accent-status')).toHaveTextContent(/Not applied/)
  })

  it('resets palette and accent to defaults', async () => {
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    await user.click(screen.getByTestId('palette-rose'))
    await user.type(screen.getByLabelText('Custom accent hex'), '#ffd54a')
    await user.click(screen.getByRole('button', { name: 'Reset to default' }))
    expect(screen.getByRole('radio', { name: /Archive/ })).toBeChecked()
    expect(screen.getByLabelText('Custom accent hex')).toHaveValue('')
    expect(rootVar('--color-accent')).toBe('')
  })
})
