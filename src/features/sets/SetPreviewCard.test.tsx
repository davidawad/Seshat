import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../../lib/fsrs'
import { SeshatProvider } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import type { CardId, SetId, StudyCard } from '../../types'
import { SetPreviewCard } from './SetPreviewCard'

afterEach(() => cleanup())
beforeEach(() => window.localStorage.clear())

const view = (cards: readonly StudyCard[]) => (
  <SeshatProvider>
    <SetPreviewCard cards={cards} />
  </SeshatProvider>
)

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
    render(view([card]))
    expect(screen.getAllByText('Space')).toHaveLength(2)
    expect(screen.getAllByText('Tip')).toHaveLength(2)
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
        <SeshatProvider>
          <SetPreviewCard cards={[card]} />
        </SeshatProvider>
      </>,
    )
    fireEvent.keyDown(screen.getByLabelText('note'), { key: ' ' })
    fireEvent.keyDown(screen.getByTestId(TESTIDS.setPreviewFlip), { key: ' ' })
    expect(flipLabel()).toBe('Show definition')
  })

  it('renders nothing for an empty set', () => {
    const { container } = render(view([]))
    expect(container).toBeEmptyDOMElement()
  })
})

const faces = () => [...document.querySelectorAll('.flip-card-face')]
const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })

describe('SetPreviewCard tip as part of the card', () => {
  it('sits inside BOTH faces, so it turns with the card, and only the visible face exposes it', () => {
    render(view([card]))
    const [front, back] = faces()
    expect(front?.querySelector('.card-tip')).not.toBeNull()
    expect(back?.querySelector('.card-tip')).not.toBeNull()
    expect(front).toHaveAttribute('aria-hidden', 'false')
    expect(back).toHaveAttribute('aria-hidden', 'true')
    const exposed = screen.getAllByText('Tip').filter((el) => el.closest('[aria-hidden="true"]') === null)
    expect(screen.getAllByText('Tip')).toHaveLength(2)
    expect(exposed).toHaveLength(1)
    expect(document.querySelector('.card-with-tip')).toBeNull()
  })

  it('disappears after the first flip by key', async () => {
    render(view([card]))
    fireEvent.keyDown(window, { key: ' ' })
    await wait(300)
    expect(screen.queryByTestId(TESTIDS.cardTip)).toBeNull()
  })

  it('disappears after the first flip by the button', async () => {
    render(view([card]))
    fireEvent.click(screen.getByTestId(TESTIDS.setPreviewFlip))
    await wait(300)
    expect(screen.queryByTestId(TESTIDS.cardTip)).toBeNull()
  })

  it('stays dismissed after a remount', () => {
    const first = render(view([card]))
    fireEvent.keyDown(window, { key: ' ' })
    first.unmount()
    expect(window.localStorage.getItem('seshat:tip-dismissed:v1')).toContain('set-preview-flip')
    render(view([card]))
    expect(screen.queryByTestId(TESTIDS.cardTip)).toBeNull()
  })

  it('drops the tip almost immediately under reduced motion', async () => {
    document.documentElement.dataset['reducedMotion'] = 'true'
    try {
      render(view([card]))
      fireEvent.keyDown(window, { key: ' ' })
      await wait(30)
      expect(screen.queryByTestId(TESTIDS.cardTip)).toBeNull()
    } finally {
      delete document.documentElement.dataset['reducedMotion']
    }
  })
})
