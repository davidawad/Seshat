import { act, cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { KEYBINDING_REGISTRY, KEYBINDING_SCOPE_LABELS } from '../lib/keybindings'
import { Footer } from './Footer'
import { ShortcutsModal } from './ShortcutsModal'

// jsdom has no native <dialog> modal support; stub the two methods Modal.tsx calls.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

afterEach(() => cleanup())

describe('ShortcutsModal', () => {
  it('lists every registry action, grouped by scope, with its resolved key', () => {
    render(<ShortcutsModal open onClose={() => undefined} titleId="shortcuts-title" />)
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
    for (const scope of new Set(KEYBINDING_REGISTRY.map((action) => action.scope))) {
      expect(within(dialog).getByRole('region', { name: KEYBINDING_SCOPE_LABELS[scope] })).toBeInTheDocument()
    }
    const flip = KEYBINDING_REGISTRY.find((action) => action.id === 'flashcards.flip')!
    const flashcards = within(dialog).getByRole('region', { name: KEYBINDING_SCOPE_LABELS.flashcards })
    expect(within(flashcards).getByText(flip.label, { exact: false })).toBeInTheDocument()
  })
})

describe('ShortcutsModal navigation presets', () => {
  it('remaps the four nav keys when a preset is chosen, and back again', () => {
    render(<ShortcutsModal open onClose={() => undefined} titleId="shortcuts-title" />)
    const navigation = () => screen.getByRole('region', { name: KEYBINDING_SCOPE_LABELS.navigation })

    expect(screen.getByTestId('nav-preset-arrows')).toBeChecked()
    expect(within(navigation()).getByText('←')).toBeInTheDocument()

    act(() => screen.getByTestId('nav-preset-wasd').click())
    expect(screen.getByTestId('nav-preset-wasd')).toBeChecked()
    expect(within(navigation()).getByText('A')).toBeInTheDocument()

    act(() => screen.getByTestId('nav-preset-hjkl').click())
    expect(within(navigation()).getByText('H')).toBeInTheDocument()

    act(() => screen.getByTestId('nav-preset-arrows').click())
    expect(screen.getByTestId('nav-preset-arrows')).toBeChecked()
    expect(within(navigation()).getByText('←')).toBeInTheDocument()
  })
})

describe('Footer shortcuts button', () => {
  it('calls onOpenShortcuts when the Keyboard shortcuts button is clicked', () => {
    const onOpenShortcuts = vi.fn()
    render(
      <MemoryRouter>
        <Footer
          onOpenSettings={() => undefined}
          onOpenShortcuts={onOpenShortcuts}
          onOpenPalette={() => undefined}
          paletteKeyHint="Ctrl+K"
        />
      </MemoryRouter>,
    )
    screen.getByRole('button', { name: 'Keyboard shortcuts' }).click()
    expect(onOpenShortcuts).toHaveBeenCalledTimes(1)
  })
})
