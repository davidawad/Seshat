import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import { MediaStoreProvider, createMemoryMediaStore } from '../../lib/media'
import { TESTIDS } from '../../lib/testids'
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
  promptImage: null,
  content: { kind: 'short-answer', answer, acceptableAnswers: [], answerImage: null },
})

const imageOcclusionCard = (id: string, prompt: string, imageDataUrl: string, label: string): StudyCard => ({
  ...baseCard(id),
  prompt,
  promptImage: null,
  content: {
    kind: 'image-occlusion',
    image: null,
    imageDataUrl,
    occlusions: [{ id: 'r1', xPct: 10, yPct: 10, widthPct: 20, heightPct: 20, label }],
  },
})

describe('SetTermList', () => {
  it('renders each card as a table row with its front and back text', () => {
    const cards = [
      shortAnswerCard('c1', 'Capital of France', 'Paris'),
      shortAnswerCard('c2', 'Capital of Italy', 'Rome'),
    ]

    render(<SetTermList cards={cards} />)

    expect(screen.getByRole('table', { name: 'Terms in this set' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Term' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Definition' })).toBeInTheDocument()
    expect(screen.getByText('Capital of France')).toBeInTheDocument()
    expect(screen.getByText('Paris')).toBeInTheDocument()
    expect(screen.getByText('Capital of Italy')).toBeInTheDocument()
    expect(screen.getByText('Rome')).toBeInTheDocument()
    expect(screen.queryByAltText('')).not.toBeInTheDocument()
    // No diagram in this set, so there is no Diagram column at all.
    expect(screen.queryByRole('columnheader', { name: 'Diagram' })).not.toBeInTheDocument()
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

  it('adds the Diagram column only when the set has a diagram card', () => {
    const cards = [
      shortAnswerCard('c1', 'Capital of France', 'Paris'),
      imageOcclusionCard('c2', 'Cell diagram', 'data:image/png;base64,CCCC', 'Nucleus'),
    ]
    render(<SetTermList cards={cards} />)
    expect(screen.getByRole('columnheader', { name: 'Diagram' })).toBeInTheDocument()
  })

  it('shows term and definition thumbnails in their own cells, without a Diagram column', () => {
    const ref = {
      id: 'b'.repeat(64),
      mime: 'image/png' as const,
      width: 4,
      height: 3,
      bytes: 9,
      alt: '',
      decorative: false,
    }
    const card = shortAnswerCard('c1', 'Heart', 'Pumps blood')
    const withImages: StudyCard = {
      ...card,
      promptImage: ref,
      content: { kind: 'short-answer', answer: 'Pumps blood', acceptableAnswers: [], answerImage: ref },
    }
    render(
      <MediaStoreProvider store={createMemoryMediaStore()}>
        <SetTermList cards={[withImages]} />
      </MediaStoreProvider>,
    )
    expect(screen.getByTestId('set-term-image').closest('td')).toHaveClass('set-term-front')
    expect(screen.getByTestId('set-definition-image').closest('td')).toHaveClass('set-term-back')
    expect(screen.queryByRole('columnheader', { name: 'Diagram' })).toBeNull()
  })

  it('renders only the header row when there are no cards', () => {
    render(<SetTermList cards={[]} />)
    expect(screen.getAllByRole('row')).toHaveLength(1)
  })

  it('shows a small masked thumbnail (only the asked region) of a per-label diagram card in the Diagram column', () => {
    const card = {
      ...imageOcclusionCard('c1', 'Heart', 'data:image/png;base64,AAAA', 'Atrium'),
      content: {
        kind: 'image-occlusion' as const,
        image: null,
        imageDataUrl: 'data:image/png;base64,AAAA',
        occlusions: [
          { id: 'r1', xPct: 10, yPct: 10, widthPct: 20, heightPct: 20, label: 'Aorta' },
          { id: 'r2', xPct: 60, yPct: 60, widthPct: 20, heightPct: 20, label: 'Atrium' },
        ],
        askedRegionId: 'r2',
      },
    }
    const { container } = render(<SetTermList cards={[card]} />)
    const thumb = screen.getByTestId(TESTIDS.setDiagramThumb)
    expect(thumb.querySelectorAll('.occlusion-box')).toHaveLength(1)
    expect(thumb.querySelector('.occlusion-box')).toHaveAttribute('data-region', 'r2')
    // The definition column carries the asked label; the thumbnail itself never spells it out.
    expect(container.querySelector('.set-term-back')).toHaveTextContent('Atrium')
    expect(thumb).not.toHaveTextContent('Atrium')
  })
})
