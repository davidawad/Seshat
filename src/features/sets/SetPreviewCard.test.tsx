import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import { TESTIDS } from '../../lib/testids'
import type { CardId, SetId, StudyCard } from '../../types'
import { SetPreviewCard } from './SetPreviewCard'

afterEach(() => cleanup())

const now = new Date().toISOString()
const card: StudyCard = {
  id: 'c1' as CardId,
  setId: 's1' as SetId,
  prompt: 'Capital of France',
  promptImage: null,
  content: { kind: 'short-answer', answer: 'Paris', acceptableAnswers: [], answerImage: null },
  explanation: null,
  sourceRef: null,
  tags: [],
  createdAt: now,
  updatedAt: now,
  scheduling: createInitialScheduling(new Date()),
}

const flipLabel = () => screen.getByTestId(TESTIDS.setPreviewFlip).textContent

describe('SetPreviewCard card tip', () => {
  it('shows the tip naming the flip key, and Space really flips the card', () => {
    render(<SetPreviewCard cards={[card]} />)
    expect(screen.getByText('Space')).toBeInTheDocument()
    expect(screen.getByText('Tip')).toBeInTheDocument()
    expect(flipLabel()).toBe('Show definition')

    fireEvent.keyDown(window, { key: ' ' })
    expect(flipLabel()).toBe('Show term')

    fireEvent.keyDown(window, { key: ' ' })
    expect(flipLabel()).toBe('Show definition')
  })

  it('leaves Space alone while a button or text field has focus', () => {
    render(
      <>
        <input aria-label="note" />
        <SetPreviewCard cards={[card]} />
      </>,
    )
    fireEvent.keyDown(screen.getByLabelText('note'), { key: ' ' })
    fireEvent.keyDown(screen.getByTestId(TESTIDS.setPreviewFlip), { key: ' ' })
    expect(flipLabel()).toBe('Show definition')
  })

  it('renders nothing for an empty set', () => {
    const { container } = render(<SetPreviewCard cards={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
