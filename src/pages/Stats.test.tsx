import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { saveState } from '../lib/storage'
import { SeshatProvider } from '../lib/store'
import { TESTIDS } from '../lib/testids'
import {
  type Activation,
  type ReviewLogEntry,
  cardIdSchema,
  createEmptyActivation,
  createEmptyAppState,
  setIdSchema,
} from '../types'
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

describe('StatsPage first week', () => {
  const renderWith = (activation: Partial<Activation>) => {
    saveState({ ...createEmptyAppState(), activation: { ...createEmptyActivation(), ...activation } })
    render(
      <SeshatProvider>
        <MemoryRouter>
          <StatsPage />
        </MemoryRouter>
      </SeshatProvider>,
    )
    return screen.getByTestId(TESTIDS.statsFirstWeek)
  }

  it('shows empty values and the never-leaves-the-device statement for a new learner', () => {
    const section = renderWith({})
    expect(section).toHaveTextContent('Your first week')
    expect(section.textContent).toMatch(/Time to first graded cardNot yet/)
    expect(section.textContent).toMatch(/Reviews so far0/)
    expect(section.textContent).toMatch(/Days studied0/)
    expect(section).toHaveTextContent('never sent anywhere')
  })

  it('shows time to first graded card, reviews and days studied', () => {
    const section = renderWith({
      firstSetAt: '2026-01-01T10:00:00.000Z',
      firstGradedAt: '2026-01-01T10:05:00.000Z',
      totalReviews: 42,
      daysStudied: 3,
    })
    expect(section.textContent).toMatch(/Time to first graded card5 minutes/)
    expect(section.textContent).toMatch(/Reviews so far42/)
    expect(section.textContent).toMatch(/Days studied3/)
  })
})
