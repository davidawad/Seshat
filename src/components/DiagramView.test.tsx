import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { OcclusionRegion } from '../types'
import { DiagramView } from './DiagramView'
import { FlipCard } from './FlipCard'

afterEach(() => cleanup())

const DATA_URL = 'data:image/png;base64,AAAA'
const regions: OcclusionRegion[] = [
  { id: 'a', xPct: 10, yPct: 10, widthPct: 20, heightPct: 20, label: 'Aorta' },
  { id: 'b', xPct: 60, yPct: 60, widthPct: 20, heightPct: 20, label: 'Atrium' },
]

const masks = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('.occlusion-box')]

describe('DiagramView', () => {
  it('masks only the asked region on the question side; the others stay visible', () => {
    const { container } = render(
      <DiagramView imageDataUrl={DATA_URL} image={null} alt="Heart" regions={regions} askedId="b" mode="question" />,
    )
    const boxes = masks(container)
    expect(boxes).toHaveLength(1)
    expect(boxes[0]).toHaveAttribute('data-region', 'b')
    // Not colour alone: a "?" glyph marks the asked mask.
    expect(boxes[0]).toHaveTextContent('?')
    expect(screen.getByRole('img', { name: 'Heart' })).toBeInTheDocument()
  })

  it('masks every region with hide-all, numbering the others and marking the asked one', () => {
    const { container } = render(
      <DiagramView
        image={null}
        imageDataUrl={DATA_URL}
        alt="Heart"
        regions={regions}
        askedId="b"
        mode="question"
        hideAll
      />,
    )
    const boxes = masks(container)
    expect(boxes.map((box) => box.textContent)).toEqual(['1', '?'])
    expect(screen.getByText(/Hidden: the label for the lower right region, and 1 other region\./)).toBeInTheDocument()
  })

  it('shows no mask and the label on the answer side', () => {
    const { container } = render(
      <DiagramView image={null} imageDataUrl={DATA_URL} alt="Heart" regions={regions} askedId="b" mode="answer" />,
    )
    expect(masks(container)).toHaveLength(0)
    expect(container.querySelector('.occlusion-chip')).toHaveTextContent('Atrium')
    expect(screen.getByText('Answer: Atrium, lower right region.')).toBeInTheDocument()
  })

  it('renders a text-free thumbnail', () => {
    const { container } = render(
      <DiagramView image={null} imageDataUrl={DATA_URL} alt="" regions={regions} askedId="a" mode="thumb" />,
    )
    expect(masks(container)).toHaveLength(1)
    expect(container).not.toHaveTextContent('Aorta')
  })
})

describe('FlipCard with a diagram', () => {
  const diagram = { regions, askedId: 'a', alt: 'A heart' }
  const face = (container: HTMLElement, side: 'front' | 'back') =>
    container.querySelector<HTMLElement>(`.flip-card-${side}`)!

  it('masks the asked region on the front and reveals its label on the back', () => {
    const { container } = render(
      <FlipCard
        front="Heart"
        back="Aorta"
        image={undefined}
        imageDataUrl={DATA_URL}
        diagram={diagram}
        flipped={false}
      />,
    )
    expect(face(container, 'front').querySelectorAll('.occlusion-box')).toHaveLength(1)
    expect(face(container, 'front').querySelector('.occlusion-chip')).toBeNull()
    expect(face(container, 'back').querySelectorAll('.occlusion-box')).toHaveLength(0)
    expect(face(container, 'back').querySelector('.occlusion-chip')).toHaveTextContent('Aorta')
  })

  it('honours hide-all labels on the front', () => {
    const { container } = render(
      <FlipCard
        front="Heart"
        back="Aorta"
        image={undefined}
        imageDataUrl={DATA_URL}
        diagram={diagram}
        hideAllLabels
        flipped={false}
      />,
    )
    expect(face(container, 'front').querySelectorAll('.occlusion-box')).toHaveLength(2)
  })

  it('swaps the faces when the definition leads', () => {
    const { container } = render(
      <FlipCard
        front="Aorta"
        back="Heart"
        image={undefined}
        imageDataUrl={DATA_URL}
        diagram={diagram}
        diagramSwapped
        flipped={false}
      />,
    )
    expect(face(container, 'front').querySelector('.occlusion-chip')).toHaveTextContent('Aorta')
    expect(face(container, 'back').querySelectorAll('.occlusion-box')).toHaveLength(1)
  })

  it('leaves non-diagram cards showing their plain image on both faces', () => {
    const { container } = render(
      <FlipCard front="q" back="a" image={undefined} imageDataUrl={DATA_URL} flipped={false} />,
    )
    expect(container.querySelectorAll('.occlusion-box, .occlusion-chip')).toHaveLength(0)
    expect(container.querySelectorAll('img')).toHaveLength(2)
  })
})
