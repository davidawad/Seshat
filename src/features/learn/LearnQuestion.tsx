import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { CardImage } from '../../components/CardImage'
import { Legible } from '../../components/Legible'
import { matchesBinding } from '../../lib/keybindings'
import { OptionAnnouncer } from '../../lib/OptionAnnouncer'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import { useKeybindings } from '../../lib/useKeybindings'
import { useNumberedShortcut } from '../../lib/useNumberedShortcut'
import { NAV_OPTION_ATTRIBUTE, useOptionNavigation } from '../../lib/useOptionNavigation'
import type { ConfidenceRating, Grade, StudyCard } from '../../types'
import { cardFrontBack } from '../study/card-summary'
import { ConfidencePrompt } from '../study/ConfidencePrompt'
import { derivedGrade, type StudyStep } from '../study/grading'
import { RevealPanel } from '../study/RevealPanel'
import { useStudyShortcuts } from '../study/useStudyShortcuts'
import { buildMultipleChoice } from '../test-mode/generate-test'
import { type Stage, attemptFor, isTypedCorrect } from './learn-session'

/** How many leading options get a digit key — see `learn.option1-4` in lib/keybindings.ts. */
const MAX_SHORTCUT_OPTIONS = 4

/** What one finished question reports back to the session. */
export interface Resolution {
  readonly correct: boolean
  readonly grade: Grade
  readonly confidence: ConfidenceRating | null
  readonly elapsedMs: number
}

interface LearnQuestionProps {
  readonly card: StudyCard
  /** The set's text cards, the pool multiple-choice distractors come from. */
  readonly cards: readonly StudyCard[]
  readonly stage: Stage
  readonly onDone: (resolution: Resolution) => void
}

const STAGE_LABEL: Readonly<Record<Stage, string>> = { choice: 'Multiple choice', typed: 'Type the answer' }

/** The "I don't know" shortcut (`learn.dontKnow`), live only while the multiple-choice options are on screen. */
const useDontKnowShortcut = (active: boolean, onPress: () => void): void => {
  const { key: keyFor } = useKeybindings()
  useEffect(() => {
    if (!active) return
    const handler = (event: KeyboardEvent) => {
      if (event.repeat || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        return
      if (matchesBinding(keyFor('learn.dontKnow'), event)) onPress()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, keyFor, onPress])
}

interface ChoiceProps {
  readonly front: string
  readonly image: ReturnType<typeof cardFrontBack>['image']
  readonly options: readonly string[]
  readonly active: boolean
  readonly onPick: (option: string) => void
}

/** Recognition stage: the prompt and up to four options; picking one commits it at once. */
const Choice = ({ front, image, options, active, onPick }: ChoiceProps) => {
  const promptId = useId()
  const promptRef = useRef<HTMLParagraphElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  const [highlight, setHighlight] = useState<number | null>(null)
  const { key: keyFor } = useKeybindings()

  // A fresh question: land on its prompt so a screen reader reads it, and arrows/digits work from there.
  useEffect(() => {
    promptRef.current?.focus()
  }, [])

  const pick = useCallback(
    (index: number) => {
      const option = options[index]
      if (option !== undefined) onPick(option)
    },
    [onPick, options],
  )
  useNumberedShortcut('learn.option', Math.min(options.length, MAX_SHORTCUT_OPTIONS), active, pick)
  useOptionNavigation({
    count: options.length,
    index: highlight,
    onIndexChange: setHighlight,
    orientation: 'vertical',
    enabled: active,
    containerRef: optionsRef,
  })

  return (
    <div className="study-card">
      <p ref={promptRef} tabIndex={-1} id={promptId} className="study-prompt" data-testid={TESTIDS.learnPrompt}>
        {front}
      </p>
      <CardImage image={image} alt="" className="study-prompt-image" />
      <div
        ref={optionsRef}
        role="group"
        aria-labelledby={promptId}
        className="study-mcq-options"
        data-testid={TESTIDS.learnOptions}
      >
        {options.map((option, index) => (
          <button
            key={`${index}-${option}`}
            type="button"
            className="study-mcq-option"
            data-testid={TESTIDS.learnOption}
            onClick={() => pick(index)}
            onFocus={() => setHighlight(index)}
            {...{ [NAV_OPTION_ATTRIBUTE]: '' }}
          >
            {option}
            {index < MAX_SHORTCUT_OPTIONS && <span className="grade-key"> ({keyFor(`learn.option${index + 1}`)})</span>}
          </button>
        ))}
      </div>
      <OptionAnnouncer index={highlight} labels={options} />
    </div>
  )
}

interface TypedProps {
  readonly front: string
  readonly image: ReturnType<typeof cardFrontBack>['image']
  readonly onSubmit: (response: string) => void
}

/** Recall stage: the prompt and a text field; Enter submits. */
const Typed = ({ front, image, onSubmit }: TypedProps) => {
  const inputId = useId()
  const promptId = useId()
  const [value, setValue] = useState('')
  return (
    <form
      className="study-card"
      onSubmit={(event) => {
        event.preventDefault()
        if (value.trim() !== '') onSubmit(value)
      }}
    >
      <p id={promptId} className="study-prompt" data-testid={TESTIDS.learnPrompt}>
        {front}
      </p>
      <CardImage image={image} alt="" className="study-prompt-image" />
      <div className="study-field">
        <label htmlFor={inputId}>Your answer</label>
        <input
          id={inputId}
          type="text"
          aria-describedby={promptId}
          data-testid={TESTIDS.learnAnswerInput}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
          autoFocus
        />
      </div>
      <div className="learn-actions">
        <button type="submit" disabled={value.trim() === ''} data-testid={TESTIDS.learnCheck}>
          Check
        </button>
        <button type="button" data-testid={TESTIDS.learnDontKnow} onClick={() => onSubmit('')}>
          I don&apos;t know
        </button>
      </div>
    </form>
  )
}

/**
 * One Learn question end to end: answer (multiple choice or typed) -> optional confidence (typed
 * answers only, when the Settings prompt is on) -> reveal with the correct answer -> Continue, or the
 * Again/Hard/Good/Easy self-rating on typed answers when that setting is on. Reuses Study's reveal
 * panel and shortcuts so feedback, live-region announcements and the settings flags behave identically.
 */
export const LearnQuestion = ({ card, cards, stage, onDone }: LearnQuestionProps) => {
  const {
    state: {
      settings: { confidencePromptEnabled, selfRatingPromptEnabled },
    },
  } = useSeshatStore()
  const [step, setStep] = useState<StudyStep>('answer')
  const [response, setResponse] = useState('')
  const [correct, setCorrect] = useState(false)
  const [confidence, setConfidence] = useState<ConfidenceRating | null>(null)
  const shownAt = useRef(performance.now())

  const face = useMemo(() => cardFrontBack(card), [card])
  const options = useMemo(() => (stage === 'choice' ? buildMultipleChoice(card, cards) : null), [card, cards, stage])

  const resolve = useCallback(
    (text: string, wasCorrect: boolean) => {
      setResponse(text)
      setCorrect(wasCorrect)
      // Confidence is only meaningful for an answer the learner actually produced.
      setStep(stage === 'typed' && confidencePromptEnabled && text.trim() !== '' ? 'confidence' : 'reveal')
    },
    [confidencePromptEnabled, stage],
  )

  const pickOption = useCallback(
    (option: string) => resolve(option, options !== null && option === options.correctOption),
    [options, resolve],
  )
  const dontKnow = useCallback(() => resolve('', false), [resolve])
  useDontKnowShortcut(stage === 'choice' && step === 'answer', dontKnow)

  const chooseConfidence = useCallback((rating: ConfidenceRating) => {
    setConfidence(rating)
    setStep('reveal')
  }, [])
  const finish = useCallback(
    (grade: Grade) => onDone({ correct, grade, confidence, elapsedMs: performance.now() - shownAt.current }),
    [confidence, correct, onDone],
  )
  const selfRating = stage === 'typed' && selfRatingPromptEnabled
  useStudyShortcuts({ step, selfRatingEnabled: selfRating, onConfidence: chooseConfidence, onGrade: finish })

  return (
    <div className="learn-question">
      <p className="learn-stage" data-testid={TESTIDS.learnStage}>
        {STAGE_LABEL[stage]}
      </p>
      {step === 'answer' && (
        <Legible className="illuminated-panel">
          {options !== null ? (
            <Choice front={face.front} image={face.image} options={options.options} active onPick={pickOption} />
          ) : (
            <Typed
              front={face.front}
              image={face.image}
              onSubmit={(text) => resolve(text, isTypedCorrect(card, text))}
            />
          )}
          {options !== null && (
            <div className="learn-actions">
              <button type="button" data-testid={TESTIDS.learnDontKnow} onClick={dontKnow}>
                I don&apos;t know
              </button>
            </div>
          )}
        </Legible>
      )}
      {step === 'confidence' && (
        <>
          <Legible className="illuminated-panel">
            <p className="study-prompt">{face.front}</p>
          </Legible>
          <ConfidencePrompt onSelect={chooseConfidence} />
        </>
      )}
      {step === 'reveal' && (
        <div className="illuminated-panel">
          <RevealPanel
            card={card}
            attempt={attemptFor(card, response)}
            correct={correct}
            onGrade={selfRating ? finish : () => finish(derivedGrade(correct))}
            selfRatingEnabled={selfRating}
            selfExplanation={null}
            onSelfExplanationChange={() => undefined}
          />
          <p className="learn-next">{nextHint(stage, correct)}</p>
        </div>
      )}
    </div>
  )
}

const nextHint = (stage: Stage, correct: boolean): string => {
  if (!correct) return 'This one comes back soon.'
  return stage === 'choice' ? 'Next time you will type this one.' : 'Mastered for this session.'
}
