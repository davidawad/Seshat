import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import type { CardId, SetId, StudyCard } from '../../types'
import { SetTermList } from './SetTermList'

// @testing-library/react's auto-cleanup needs a global `afterEach`, which
// this project doesn't enable (no `test.globals: true` in vite.config.ts) —
// without this, DOM from one test leaks into the next.
afterEach(() => cleanup())

const setId = 'set-1' as SetId

const baseCard = (
  id: string,
): Pick<
  StudyCard,
  'id' | 'setId' | 'explanation' | 'sourceRef' | 'tags' | 'createdAt' | 'updatedAt' | 'scheduling'
> => {
  const now = new Date().toISOString()
  return {
    id: id as CardId,
    setId,
    explanation: null,
    sourceRef: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
    scheduling: createInitialScheduling(new Date()),
  }
}

const shortAnswerCard = (id: string, prompt: string, answer: string): StudyCard => ({
  ...baseCard(id),
  prompt,
  content: { kind: 'short-answer', answer, acceptableAnswers: [] },
})

const imageOcclusionCard = (id: string, prompt: string, imageDataUrl: string, label: string): StudyCard => ({
  ...baseCard(id),
  prompt,
  content: {
    kind: 'image-occlusion',
    imageDataUrl,
    occlusions: [{ id: 'r1', xPct: 10, yPct: 10, widthPct: 20, heightPct: 20, label }],
  },
})

describe('SetTermList', () => {
  it('renders each card as a labeled list with its front and back text', () => {
    const cards = [
      shortAnswerCard('c1', 'Capital of France', 'Paris'),
      shortAnswerCard('c2', 'Capital of Italy', 'Rome'),
    ]

    render(<SetTermList cards={cards} />)

    expect(screen.getByRole('list', { name: 'Terms in this set' })).toBeInTheDocument()
    expect(screen.getByText('Capital of France')).toBeInTheDocument()
    expect(screen.getByText('Paris')).toBeInTheDocument()
    expect(screen.getByText('Capital of Italy')).toBeInTheDocument()
    expect(screen.getByText('Rome')).toBeInTheDocument()
    expect(screen.queryByAltText('')).not.toBeInTheDocument()
  })

  it('renders an inline thumbnail image for an image-occlusion card, using its own image data', () => {
    const dataUrl = 'data:image/png;base64,AAAA'
    const cards = [imageOcclusionCard('c1', 'Cell diagram', dataUrl, 'Nucleus')]

    render(<SetTermList cards={cards} />)

    const image = screen.getByAltText('')
    expect(image.tagName).toBe('IMG')
    expect(image).toHaveAttribute('src', dataUrl)
    expect(screen.getByText('Nucleus')).toBeInTheDocument()
  })

  it('only shows a thumbnail next to the image-occlusion card it belongs to, not every card', () => {
    const dataUrl = 'data:image/png;base64,BBBB'
    const cards = [
      shortAnswerCard('c1', 'Capital of France', 'Paris'),
      imageOcclusionCard('c2', 'Cell diagram', dataUrl, 'Nucleus'),
    ]

    render(<SetTermList cards={cards} />)

    expect(screen.getAllByAltText('')).toHaveLength(1)
  })

  it('renders an empty list when there are no cards', () => {
    render(<SetTermList cards={[]} />)
    expect(screen.getByRole('list', { name: 'Terms in this set' })).toBeEmptyDOMElement()
  })
})
