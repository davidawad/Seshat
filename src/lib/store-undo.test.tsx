import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearMirrors } from './persistence'
import { SeshatProvider, useSeshatStore } from './store'

afterEach(() => cleanup())

type Store = ReturnType<typeof useSeshatStore>

const mount = (): { readonly current: () => Store } => {
  let latest: Store | null = null
  const Probe = () => {
    latest = useSeshatStore()
    return null
  }
  render(
    <SeshatProvider>
      <Probe />
    </SeshatProvider>,
  )
  return {
    current: () => {
      if (latest === null) throw new Error('store not mounted')
      return latest
    },
  }
}

const seedCard = (store: ReturnType<typeof mount>) => {
  let cardId = ''
  act(() => {
    const set = store.current().addSet({ name: 'Bio', description: '', tags: [] })
    cardId = store.current().addCard(set.id, {
      prompt: 'Q',
      content: { kind: 'short-answer', answer: 'a', acceptableAnswers: [], answerImage: null },
      explanation: null,
      sourceRef: null,
      tags: [],
    }).id
  })
  return store.current().state.cards.find((card) => card.id === cardId)!
}

describe('SeshatProvider undoReview', () => {
  beforeEach(() => {
    window.localStorage.clear()
    clearMirrors()
  })

  it('recordReview returns the review timestamp, or null for an unknown card', () => {
    const store = mount()
    const card = seedCard(store)
    let reviewedAt: string | null = null
    let missing: string | null = 'unset'
    act(() => {
      reviewedAt = store.current().recordReview(card.id, 'good', null, true, 100)
      missing = store.current().recordReview('nope' as typeof card.id, 'good', null, true, 100)
    })
    expect(reviewedAt).toBe(store.current().state.reviewLog[0]?.reviewedAt)
    expect(missing).toBeNull()
  })

  it('restores the previous scheduling and removes exactly that log entry', () => {
    const store = mount()
    const card = seedCard(store)
    let reviewedAt: string | null = null
    act(() => {
      reviewedAt = store.current().recordReview(card.id, 'good', null, true, 100)
    })
    expect(store.current().state.cards[0]?.scheduling).not.toEqual(card.scheduling)
    expect(store.current().state.reviewLog).toHaveLength(1)

    act(() => store.current().undoReview(card.id, card.scheduling, reviewedAt!))

    expect(store.current().state.cards[0]?.scheduling).toEqual(card.scheduling)
    expect(store.current().state.reviewLog).toHaveLength(0)
  })

  it('leaves other log entries alone when the timestamp does not match', () => {
    const store = mount()
    const card = seedCard(store)
    act(() => {
      store.current().recordReview(card.id, 'good', null, true, 100)
    })
    act(() => store.current().undoReview(card.id, card.scheduling, '2000-01-01T00:00:00.000Z'))
    expect(store.current().state.reviewLog).toHaveLength(1)
  })
})
