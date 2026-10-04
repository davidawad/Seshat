import { useEffect, useRef, useState } from 'react'
import { Legible } from '../../../components/Legible'
import { OptionAnnouncer } from '../../../lib/OptionAnnouncer'
import { TESTIDS } from '../../../lib/testids'
import { useNumberedShortcut } from '../../../lib/useNumberedShortcut'
import { NAV_OPTION_ATTRIBUTE, useOptionNavigation } from '../../../lib/useOptionNavigation'
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

interface BlocksStatusBarProps {
  readonly score: number
  readonly questionIndex: number
  readonly totalQuestions: number
  readonly bestScoreAtStart: number | null
  readonly isComplete: boolean
  readonly isNewBest: boolean
}

/** The score/progress/best-score header — split out of `BlocksSession` to keep that component's size/complexity in check. */
const BlocksStatusBar = ({
  score,
  questionIndex,
  totalQuestions,
  bestScoreAtStart,
  isComplete,
  isNewBest,
}: BlocksStatusBarProps) => (
  <div className="blocks-status-bar">
    <p className="blocks-score">Score: {score}</p>
    <p className="blocks-progress">
      Card {Math.min(questionIndex + 1, totalQuestions)} / {totalQuestions}
    </p>
    <p className="blocks-best">
      {bestScoreAtStart === null ? 'No personal best yet' : `Best: ${bestScoreAtStart}`}
      {isComplete && isNewBest && ' (new)'}
    </p>
  </div>
)

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

interface BlocksQuestionViewProps {
  readonly question: BlocksQuestion
  readonly onAnswer: (option: string) => void
}

/** The "answer a question" phase view — split out of `BlocksSession` to keep that component's size/complexity in check. Mounted per question (`key`), so the arrow-key highlight resets for each one. */
const BlocksQuestionView = ({ question, onAnswer }: BlocksQuestionViewProps) => {
  const [highlight, setHighlight] = useState<number | null>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  useOptionNavigation({
    count: question.options.length,
    index: highlight,
    onIndexChange: setHighlight,
    onConfirm: (index) => {
      const option = question.options[index]
      if (option !== undefined) onAnswer(option)
    },
    orientation: 'vertical',
    enabled: true,
    containerRef: optionsRef,
  })
  return (
    <>
      <Legible as="fieldset" className="blocks-question">
        <legend className="blocks-prompt">{question.prompt}</legend>
        <div ref={optionsRef} className="blocks-options">
          {question.options.map((option, index) => (
            <button
              key={option}
              type="button"
              className="blocks-option"
              data-testid={TESTIDS.blocksOption}
              onClick={() => onAnswer(option)}
              onFocus={() => setHighlight(index)}
              {...{ [NAV_OPTION_ATTRIBUTE]: '' }}
            >
              {option}
            </button>
          ))}
        </div>
      </Legible>
      <OptionAnnouncer index={highlight} labels={question.options} />
    </>
  )
}

interface BlocksPlacingViewProps {
  readonly columns: readonly number[]
  readonly onPlace: (column: number) => void
}

/** The "drop your earned block" phase view — split out for the same reason as `BlocksQuestionView` above. Full columns are skipped by arrow-key navigation. */
const BlocksPlacingView = ({ columns, onPlace }: BlocksPlacingViewProps) => {
  const [highlight, setHighlight] = useState<number | null>(null)
  const columnsRef = useRef<HTMLFieldSetElement>(null)
  useOptionNavigation({
    count: columns.length,
    index: highlight,
    onIndexChange: setHighlight,
    onConfirm: onPlace,
    orientation: 'horizontal',
    enabled: true,
    containerRef: columnsRef,
    isDisabled: (col) => !canPlace(columns, col),
  })
  return (
    <>
      <fieldset ref={columnsRef} className="blocks-columns">
        <legend className="visually-hidden">Choose a column for your block</legend>
        {columns.map((_, col) => (
          <button
            key={col}
            type="button"
            className="blocks-column-button"
            data-testid={TESTIDS.blocksColumn}
            disabled={!canPlace(columns, col)}
            onClick={() => onPlace(col)}
            onFocus={() => setHighlight(col)}
            {...{ [NAV_OPTION_ATTRIBUTE]: '' }}
          >
            Column {col + 1}
          </button>
        ))}
      </fieldset>
    </>
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

  // Digit-key select, one shortcut per mutually-exclusive phase (the
  // registry gives each phase its own scope so both can use '1'-N without
  // colliding — see keybindings.ts).
  const currentAnswerOptions = questions[questionIndex]?.options
  useNumberedShortcut(
    'blocksQuestion.selectOption',
    currentAnswerOptions?.length ?? 0,
    phase === 'question',
    (index) => {
      const option = currentAnswerOptions?.[index]
      if (option !== undefined) handleAnswer(option)
    },
  )
  useNumberedShortcut('blocksPlacing.column', columns.length, phase === 'placing', handlePlace)

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
      <BlocksStatusBar
        score={score}
        questionIndex={questionIndex}
        totalQuestions={questions.length}
        bestScoreAtStart={bestScoreAtStart}
        isComplete={isComplete}
        isNewBest={isNewBest}
      />

      <p role="status" className="blocks-feedback" data-testid={TESTIDS.blocksFeedback}>
        {feedback}
      </p>

      {!isComplete && (
        <div className="blocks-board" data-testid={TESTIDS.blocksBoard}>
          <BlocksGrid columns={columns} />
          <div className="blocks-panel">
            {phase === 'question' && currentQuestion && (
              <BlocksQuestionView key={questionIndex} question={currentQuestion} onAnswer={handleAnswer} />
            )}
            {phase === 'placing' && <BlocksPlacingView columns={columns} onPlace={handlePlace} />}
          </div>
        </div>
      )}

      {isComplete && (
        <div className="illuminated-panel blocks-complete" role="status">
          <p className="blocks-final-score">Final score: {score}</p>
          <p className="blocks-final-clears">
            Rows cleared: {rowsCleared} &middot; Columns cleared: {columnsCleared}
          </p>
          <button
            type="button"
            className="blocks-play-again"
            data-testid={TESTIDS.blocksPlayAgain}
            onClick={handlePlayAgain}
            autoFocus
          >
            Play again
          </button>
        </div>
      )}
    </div>
  )
}
