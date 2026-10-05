import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { TESTIDS } from '../../lib/testids'
import { FlashcardOptionsModal } from './FlashcardOptionsModal'

afterEach(() => cleanup())

// jsdom has no native <dialog> modal support.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

describe('FlashcardOptionsModal card size', () => {
  it('offers Small, Medium and Large, shows the saved one, and reports a change', async () => {
    const onCardSizeChange = vi.fn()
    render(
      <FlashcardOptionsModal
        open
        options={{ trackProgress: true, front: 'term', cardSize: 'medium' }}
        onClose={() => undefined}
        onTrackProgressChange={() => undefined}
        onFrontChange={() => undefined}
        onCardSizeChange={onCardSizeChange}
        onRestart={() => undefined}
      />,
    )
    const select = screen.getByTestId(TESTIDS.flashcardCardSize)
    expect(select).toHaveValue('medium')
    expect([...select.querySelectorAll('option')].map((option) => option.textContent)).toEqual([
      'Small',
      'Medium',
      'Large',
    ])
    await userEvent.setup().selectOptions(select, 'large')
    expect(onCardSizeChange).toHaveBeenCalledWith('large')
  })
})
