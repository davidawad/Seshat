import { useEffect, useRef, useState } from 'react'
import { Legible } from '../../../components/Legible'
import type { SetId, StudyCard } from '../../../types'
import { getBestScore, recordScore } from './bestScore'
import './blocks.css'
import { GRID_COLUMNS, canPlace, createEmptyGrid, isGridFull, placePiece, pointsForPlacement } from './grid'
import { type BlocksQuestion, buildQuestions } from './round'

/** How long feedback about a wrong answer or a placement stays on screen before the next turn starts. */
const ADVANCE_DWELL_MS = 900

type Phase = 'question' | 'placing' | 'complete'

interface BlocksSessionProps {
  readonly setId: SetId
  readonly cards: readonly StudyCard[]
}

interface BlocksGridProps {
  readonly columns: readonly number[]
}

/** Renders the fixed grid as filled/empty cells, bottom-up per column. UI chrome, not card content — not wrapped in `Legible`. */
const BlocksGrid = ({ columns }: BlocksGridProps) => {
  const rows = Array.from({ length: 8 }, (_, rowFromTop) => rowFromTop)
  return (
    <div className="blocks-grid" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr)` }}>
      {rows.map((rowFromTop) =>
        columns.map((height, col) => {
          const rowFromBottom = rows.length - 1 - rowFromTop
          const filled = height > rowFromBottom
          return <div key={`${rowFromTop}-${col}`} className={filled ? 'blocks-cell is-filled' : 'blocks-cell'} />
        }),
      )}
    </div>
  )
}

export const BlocksSession = ({ setId, cards }: BlocksSessionProps) => {
  const [questions, setQuestions] = useState<readonly BlocksQuestion[]>(() => buildQuestions(cards))
  const [questionIndex, setQuestionIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('question')
  const [columns, setColumns] = useState<readonly number[]>(() => createEmptyGrid(GRID_COLUMNS))
  const [score, setScore] = useState(0)
  const [rowsCleared, setRowsCleared] = useState(0)
  const [columnsCleared, setColumnsCleared] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [bestScoreAtStart, setBestScoreAtStart] = useState<number | null>(() => getBestScore(setId))
  const [isNewBest, setIsNewBest] = useState(false)

  const advanceTimeoutRef = useRef<number | null>(null)

  // Clear any pending advance timeout on unmount (e.g. navigating away mid-dwell).
  useEffect(
    () => () => {
      if (advanceTimeoutRef.current !== null) window.clearTimeout(advanceTimeoutRef.current)
    },
    [],
  )

  const finishGame = (finalScore: number) => {
    setPhase('complete')
    const previousBest = bestScoreAtStart
    const updatedBest = recordScore(setId, finalScore)
    const wonBest = previousBest === null || finalScore > previousBest
    setIsNewBest(wonBest)
    setBestScoreAtStart(updatedBest)
    setFeedback(
      wonBest ? `Game complete — score ${finalScore}, a new personal best.` : `Game complete — score ${finalScore}.`,
    )
  }

  const advance = (latestColumns: readonly number[], latestScore: number) => {
    advanceTimeoutRef.current = null
    const nextIndex = questionIndex + 1
    if (nextIndex >= questions.length || isGridFull(latestColumns)) {
      finishGame(latestScore)
      return
    }
    setQuestionIndex(nextIndex)
    setPhase('question')
  }

  const handleAnswer = (option: string) => {
    if (phase !== 'question') return
    const question = questions[questionIndex]
    if (question === undefined) return

    if (option === question.correctOption) {
      setFeedback('Correct — choose a column to drop your block.')
      setPhase('placing')
      return
    }

    setFeedback(`Not quite. The answer was "${question.correctOption}".`)
    advanceTimeoutRef.current = window.setTimeout(() => advance(columns, score), ADVANCE_DWELL_MS)
  }

  const handlePlace = (column: number) => {
    if (phase !== 'placing' || !canPlace(columns, column)) return

    const result = placePiece(columns, column)
    const gained = pointsForPlacement(result)
    const newScore = score + gained

    setColumns(result.columns)
    setScore(newScore)
    if (result.clearedRow) setRowsCleared((count) => count + 1)
    if (result.clearedColumn) setColumnsCleared((count) => count + 1)
    setFeedback(
      result.clearedRow
        ? `Row cleared! +${gained} points.`
        : result.clearedColumn
          ? `Column cleared! +${gained} points.`
          : `Block placed. +${gained} points.`,
    )

    advanceTimeoutRef.current = window.setTimeout(() => advance(result.columns, newScore), ADVANCE_DWELL_MS)
  }

  const handlePlayAgain = () => {
    if (advanceTimeoutRef.current !== null) {
      window.clearTimeout(advanceTimeoutRef.current)
      advanceTimeoutRef.current = null
    }
    setQuestions(buildQuestions(cards))
    setQuestionIndex(0)
    setPhase('question')
    setColumns(createEmptyGrid(GRID_COLUMNS))
    setScore(0)
    setRowsCleared(0)
    setColumnsCleared(0)
    setFeedback('')
    setBestScoreAtStart(getBestScore(setId))
    setIsNewBest(false)
  }

  const currentQuestion = questions[questionIndex]
  const isComplete = phase === 'complete'

  return (
    <div className="blocks-session">
      <div className="blocks-status-bar">
        <p className="blocks-score">Score: {score}</p>
        <p className="blocks-progress">
          Card {Math.min(questionIndex + 1, questions.length)} / {questions.length}
        </p>
        <p className="blocks-best">
          {bestScoreAtStart === null ? 'No personal best yet' : `Best: ${bestScoreAtStart}`}
          {isComplete && isNewBest && ' (new)'}
        </p>
      </div>

      <p role="status" aria-live="polite" className="blocks-feedback">
        {feedback}
      </p>

      {!isComplete && <BlocksGrid columns={columns} />}

      {phase === 'question' && currentQuestion && (
        <Legible as="fieldset" className="blocks-question">
          <legend className="blocks-prompt">{currentQuestion.prompt}</legend>
          <div className="blocks-options">
            {currentQuestion.options.map((option) => (
              <button key={option} type="button" className="blocks-option" onClick={() => handleAnswer(option)}>
                {option}
              </button>
            ))}
          </div>
        </Legible>
      )}

      {phase === 'placing' && (
        <fieldset className="blocks-columns">
          <legend className="visually-hidden">Choose a column for your block</legend>
          {columns.map((_, col) => (
            <button
              key={col}
              type="button"
              className="blocks-column-button"
              disabled={!canPlace(columns, col)}
              onClick={() => handlePlace(col)}
            >
              Column {col + 1}
            </button>
          ))}
        </fieldset>
      )}

      {isComplete && (
        <div className="blocks-complete">
          <p className="blocks-final-score">Final score: {score}</p>
          <p className="blocks-final-clears">
            Rows cleared: {rowsCleared} &middot; Columns cleared: {columnsCleared}
          </p>
          <button type="button" className="blocks-play-again" onClick={handlePlayAgain} autoFocus>
            Play again
          </button>
        </div>
      )}
    </div>
  )
}
