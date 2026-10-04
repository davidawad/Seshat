import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { saveState } from '../lib/storage'
import { SeshatProvider } from '../lib/store'
import { TESTIDS } from '../lib/testids'
import { type ReviewLogEntry, cardIdSchema, createEmptyAppState, setIdSchema } from '../types'
import { StatsPage } from './Stats'

afterEach(() => cleanup())

beforeEach(() => {
  window.localStorage.clear()
})

const entry = (confidence: ReviewLogEntry['confidence']): ReviewLogEntry => ({
  cardId: cardIdSchema.parse('c1111111-1111-4111-8111-111111111111'),
  setId: setIdSchema.parse('a1111111-1111-4111-8111-111111111111'),
  reviewedAt: new Date().toISOString(),
  grade: 'good',
  confidence,
  correct: true,
  retrievabilityAtReview: null,
  elapsedMs: 1000,
  selfExplanation: null,
})

const renderWithLog = (reviewLog: readonly ReviewLogEntry[]) => {
  saveState({ ...createEmptyAppState(), reviewLog: [...reviewLog] })
  render(
    <SeshatProvider>
      <MemoryRouter>
        <StatsPage />
      </MemoryRouter>
    </SeshatProvider>,
  )
}

describe('StatsPage calibration with optional confidence', () => {
  it('shows a hint instead of an empty table when every review has confidence null', () => {
    renderWithLog([entry(null), entry(null)])
    expect(screen.getByTestId(TESTIDS.statsCalibrationEmpty)).toHaveTextContent(/turn on the confidence prompt/i)
    expect(screen.queryByTestId(TESTIDS.statsCalibrationTable)).not.toBeInTheDocument()
    expect(screen.getByText('Reviewed today').nextSibling).toHaveTextContent('2')
  })

  it('shows the calibration table, counting only rated reviews, once any confidence exists', () => {
    renderWithLog([entry(null), entry('sure')])
    expect(screen.getByTestId(TESTIDS.statsCalibrationTable)).toBeInTheDocument()
    expect(screen.queryByTestId(TESTIDS.statsCalibrationEmpty)).not.toBeInTheDocument()
  })
})
