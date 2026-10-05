import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { type MediaRef, MediaStoreProvider, createMemoryMediaStore } from '../../lib/media'
import { identityProcess, pngBytes } from '../../lib/media/test-helpers'
import { CardImageSlot } from './CardImageSlot'

afterEach(() => cleanup())

const Harness = ({ onValue }: { readonly onValue: (value: MediaRef | null) => void }) => {
  const [value, setValue] = useState<MediaRef | null>(null)
  return (
    <MediaStoreProvider store={createMemoryMediaStore()}>
      <CardImageSlot
        label="term image"
        context="card 1"
        value={value}
        process={identityProcess}
        onChange={(next) => {
          setValue(next)
          onValue(next)
        }}
      />
    </MediaStoreProvider>
  )
}

const picture = (seed: number) => new File([pngBytes(seed).slice().buffer], 'a.png', { type: 'image/png' })

describe('CardImageSlot', () => {
  it('adds an image from a file, edits alt text, and removes it', async () => {
    const user = userEvent.setup()
    const seen: (MediaRef | null)[] = []
    render(<Harness onValue={(value) => seen.push(value)} />)

    await user.upload(screen.getByLabelText('Choose term image for card 1'), picture(1))
    await waitFor(() => expect(screen.getByTestId('image-slot-thumb')).toBeInTheDocument())
    expect(seen.at(-1)).toMatchObject({ mime: 'image/png', width: 40, height: 30, alt: '' })

    await user.type(screen.getByLabelText('Alt text for term image for card 1'), 'A heart')
    await user.tab()
    expect(seen.at(-1)?.alt).toBe('A heart')

    await user.click(screen.getByRole('button', { name: 'Remove term image for card 1' }))
    expect(seen.at(-1)).toBeNull()
    expect(screen.getByRole('button', { name: 'Add term image for card 1' })).toBeInTheDocument()
  })

  it('replacing keeps the alt text', async () => {
    const user = userEvent.setup()
    const seen: (MediaRef | null)[] = []
    render(<Harness onValue={(value) => seen.push(value)} />)
    await user.upload(screen.getByLabelText('Choose term image for card 1'), picture(1))
    await waitFor(() => screen.getByTestId('image-slot-thumb'))
    await user.type(screen.getByLabelText('Alt text for term image for card 1'), 'Heart')
    await user.tab()
    await user.upload(screen.getByLabelText('Choose term image for card 1'), picture(2))
    await waitFor(() => expect(seen.length).toBe(3))
    expect(seen.at(-1)?.alt).toBe('Heart')
    expect(seen.at(-1)?.id).not.toBe(seen[0]?.id)
  })
})
