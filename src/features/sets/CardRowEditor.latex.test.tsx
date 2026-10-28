import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SeshatProvider } from '../../lib/store'
import { SetCreatePage } from './SetCreatePage'

afterEach(() => cleanup())
beforeEach(() => window.localStorage.clear())

const renderPage = () =>
  render(
    <SeshatProvider>
      <MemoryRouter>
        <SetCreatePage />
      </MemoryRouter>
    </SeshatProvider>,
  )

describe('LaTeX in the card editor', () => {
  it('inserts $..$ around the caret and leaves the caret inside', async () => {
    const user = userEvent.setup()
    renderPage()
    const term = screen.getByRole('textbox', { name: 'Term for card 1' })
    await user.click(term)
    await user.click(screen.getByRole('button', { name: /Insert a LaTeX formula in the term for card 1/ }))
    expect(term).toHaveValue('$$')
    await waitFor(() => expect((term as HTMLTextAreaElement).selectionStart).toBe(1))
  })

  it('wraps the selected text', async () => {
    const user = userEvent.setup()
    renderPage()
    const definition = screen.getByRole('textbox', { name: 'Definition for card 1' }) as HTMLTextAreaElement
    await user.type(definition, 'x^2')
    definition.setSelectionRange(0, 3)
    await user.click(screen.getByRole('button', { name: /Insert a LaTeX formula in the definition for card 1/ }))
    expect(definition).toHaveValue('$x^2$')
  })

  it('shows a typeset preview only while the text contains a formula', async () => {
    const user = userEvent.setup()
    renderPage()
    const term = screen.getByRole('textbox', { name: 'Term for card 1' })
    await user.type(term, 'plain words')
    expect(screen.queryByLabelText('Term preview')).toBeNull()
    await user.clear(term)
    await user.type(term, 'Area $\\pi r^2$')
    const preview = screen.getByLabelText('Term preview')
    await waitFor(() => expect(preview.querySelector('svg')).not.toBeNull(), { timeout: 10_000 })
  })
})
