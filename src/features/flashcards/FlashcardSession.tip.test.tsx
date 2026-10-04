import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeCard, renderSession, seedStore } from './session-test-helpers'

afterEach(() => cleanup())
beforeEach(() => window.localStorage.clear())

describe('FlashcardSession card tip', () => {
  it('puts the tip inside both faces, exposes it once, and retires it after the first grade', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    renderSession(card)
    for (const face of document.querySelectorAll('.flip-card-face'))
      expect(face.querySelector('.card-tip')).not.toBeNull()
    expect(document.querySelector('.flip-card-back')).toHaveAttribute('aria-hidden', 'true')
    expect(document.querySelector('.card-with-tip')).toBeNull()

    await user.keyboard(' ')
    expect(screen.getAllByTestId('card-tip')).toHaveLength(2) // a flip alone does not retire it

    await user.click(screen.getByRole('button', { name: /^Know/ }))
    await waitFor(() => expect(screen.queryByTestId('card-tip')).toBeNull())
    expect(window.localStorage.getItem('seshat:tip-dismissed:v1')).toContain('flashcards-grade')
  })

  it('retires the tip after a grade by key too', async () => {
    const user = userEvent.setup()
    const card = makeCard()
    seedStore(card)
    renderSession(card)
    await user.keyboard('{ArrowRight}')
    await waitFor(() => expect(screen.queryByTestId('card-tip')).toBeNull())
  })

  it('shows no tip when the learner already dismissed it', () => {
    window.localStorage.setItem('seshat:tip-dismissed:v1', '["flashcards-grade"]')
    const card = makeCard()
    seedStore(card)
    renderSession(card)
    expect(screen.queryByTestId('card-tip')).toBeNull()
  })
})
