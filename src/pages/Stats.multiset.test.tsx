import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SeshatProvider, useSeshatStore } from '../lib/store'
import { TESTIDS } from '../lib/testids'
import type { ExportedSet } from '../types'
import { StatsPage } from './Stats'

afterEach(() => cleanup())
beforeEach(() => window.localStorage.clear())

const makeSet = (name: string, cards: number): ExportedSet => ({
  seshatExportVersion: 1,
  name,
  description: '',
  tags: [],
  cards: Array.from({ length: cards }, (_, i) => ({
    prompt: `${name} q${i}`,
    promptImage: null,
    content: { kind: 'short-answer' as const, answer: `a${i}`, acceptableAnswers: [], answerImage: null },
    explanation: null,
    sourceRef: null,
    tags: [],
  })),
})

const wrapper = ({ children }: { readonly children: ReactNode }) => (
  <SeshatProvider>
    <MemoryRouter>{children}</MemoryRouter>
  </SeshatProvider>
)

describe('StatsPage after reviewing several sets', () => {
  it('counts reviews across every set', () => {
    const { result } = renderHook(() => useSeshatStore(), { wrapper })
    act(() => {
      result.current.importSet(makeSet('A', 3))
      result.current.importSet(makeSet('B', 3))
      result.current.importSet(makeSet('C', 3))
    })
    expect(result.current.state.cards).toHaveLength(9)

    for (const setIndex of [0, 1, 2]) {
      const setId = result.current.state.sets[setIndex]!.id
      const cards = result.current.state.cards.filter((card) => card.setId === setId)
      for (const [i, card] of cards.entries()) {
        act(() => {
          result.current.recordReview(card.id, i === 0 ? 'again' : 'good', 'sure', i !== 0, 1000)
        })
      }
    }

    expect(result.current.state.reviewLog).toHaveLength(9)
    cleanup()
    render(<StatsPage />, { wrapper })
    expect(screen.getByText('Reviewed today').nextSibling).toHaveTextContent('9')
    expect(screen.getByTestId(TESTIDS.statsCalibrationTable)).toBeInTheDocument()
  })
})
