import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInitialScheduling } from '../lib/fsrs'
import { clearMirrors } from '../lib/persistence'
import { saveState } from '../lib/storage'
import { SeshatProvider } from '../lib/store'
import { TESTIDS } from '../lib/testids'
import { type CardContent, cardIdSchema, createEmptyAppState, setIdSchema } from '../types'
import { GameSessionPage, GamesListPage } from './Games'
import { TestPage } from './Test'

afterEach(() => cleanup())
beforeEach(() => {
  window.localStorage.clear()
  clearMirrors()
})

const setId = setIdSchema.parse('a1111111-1111-4111-8111-111111111111')

const card = (n: number, content: CardContent) => {
  const now = new Date().toISOString()
  return {
    id: cardIdSchema.parse(`c000000${n}-1111-4111-8111-111111111111`),
    setId,
    prompt: `Prompt ${n}`,
    content,
    explanation: null,
    sourceRef: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
    scheduling: createInitialScheduling(new Date()),
  }
}
const textCard = (n: number) => card(n, { kind: 'short-answer', answer: `Answer ${n}`, acceptableAnswers: [] })
const imageCard = (n: number) =>
  card(n, {
    kind: 'image-occlusion',
    imageDataUrl: 'data:image/jpeg;base64,AAAA',
    occlusions: [{ id: 'r1', xPct: 0, yPct: 0, widthPct: 50, heightPct: 50, label: 'Heart' }],
  })

const seed = (cards: ReturnType<typeof card>[]) =>
  saveState({
    ...createEmptyAppState(),
    sets: [
      {
        id: setId,
        name: 'Mixed',
        description: '',
        tags: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        goalDate: null,
      },
    ],
    cards,
  })

const renderAt = (path: string) =>
  render(
    <SeshatProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/sets/:id/test" element={<TestPage />} />
          <Route path="/sets/:id/games" element={<GamesListPage />} />
          <Route path="/sets/:id/games/:gameId" element={<GameSessionPage />} />
        </Routes>
      </MemoryRouter>
    </SeshatProvider>,
  )

describe('Test page with image cards', () => {
  it('tests only the text cards and says how many image cards were left out', () => {
    seed([textCard(1), textCard(2), imageCard(3)])
    renderAt(`/sets/${setId}/test`)
    expect(screen.getByTestId(TESTIDS.testImageNote)).toHaveTextContent('1 image card is only available in Study')
    expect(screen.getAllByTestId(TESTIDS.testQuestion)).toHaveLength(2)
  })

  it('explains itself when every card is an image card', () => {
    seed([imageCard(1), imageCard(2)])
    renderAt(`/sets/${setId}/test`)
    expect(screen.getByTestId(TESTIDS.testNoTextCards)).toBeInTheDocument()
    expect(screen.queryByTestId(TESTIDS.testQuestion)).toBeNull()
  })
})

describe('Games with image cards', () => {
  it('disables every game with the reason when all cards are image cards', () => {
    seed([imageCard(1), imageCard(2), imageCard(3), imageCard(4)])
    renderAt(`/sets/${setId}/games`)
    expect(screen.getByTestId(TESTIDS.gamesImageNote)).toHaveTextContent('4 image cards are only available in Study')
    expect(screen.queryByTestId(TESTIDS.gamesOpenMatch)).toBeNull()
    expect(screen.getAllByText(/this set has 0\./)).toHaveLength(3)
  })

  it('counts only text cards towards a game and keeps it playable with enough', () => {
    seed([textCard(1), textCard(2), textCard(3), textCard(4), textCard(5), textCard(6), imageCard(7)])
    renderAt(`/sets/${setId}/games`)
    expect(screen.getByTestId(TESTIDS.gamesImageNote)).toBeInTheDocument()
    expect(screen.getByTestId(TESTIDS.gamesOpenMatch)).toBeInTheDocument()
  })

  it('a direct game URL for an all-image set shows the reason instead of crashing', () => {
    seed([imageCard(1), imageCard(2)])
    renderAt(`/sets/${setId}/games/blocks`)
    expect(screen.getByText(/text card/)).toBeInTheDocument()
    expect(screen.getByTestId(TESTIDS.gamesImageNote)).toBeInTheDocument()
  })
})
