import { type KeyboardEvent, type RefObject, useEffect, useId, useLayoutEffect, useRef } from 'react'
import { MathText } from '../../components/MathText'
import { DeleteIcon } from '../../components/icons'
import { hasMath } from '../../lib/math/split'
import { TESTIDS } from '../../lib/testids'
import { CardImageSlot } from './CardImageSlot'
import type { DraftRow, DraftRowPatch } from './set-draft'

/** Grows a textarea to fit its content (height tracks scrollHeight; jsdom reports 0, which is harmless). */
const useAutoGrow = (ref: RefObject<HTMLTextAreaElement | null>, value: string) => {
  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) return
    element.style.height = 'auto'
    if (element.scrollHeight > 0) element.style.height = `${element.scrollHeight}px`
  }, [ref, value])
}

interface FieldProps {
  readonly label: string
  readonly cardNumber: number
  readonly value: string
  readonly invalid: boolean
  readonly describedBy: string | undefined
  readonly testId: string
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>
  readonly onChange: (value: string) => void
  readonly onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
}

const CardField = ({
  label,
  cardNumber,
  value,
  invalid,
  describedBy,
  testId,
  textareaRef,
  onChange,
  onKeyDown,
}: FieldProps) => {
  const id = useId()
  useAutoGrow(textareaRef, value)

  // Wraps the selection (or the caret) in $...$ and leaves the caret inside, ready to type TeX.
  const insertFormula = () => {
    const element = textareaRef.current
    const start = element?.selectionStart ?? value.length
    const end = element?.selectionEnd ?? start
    onChange(`${value.slice(0, start)}$${value.slice(start, end)}$${value.slice(end)}`)
    requestAnimationFrame(() => {
      element?.focus()
      element?.setSelectionRange(start + 1, end + 1)
    })
  }

  return (
    <div className="card-editor-field">
      <textarea
        id={id}
        ref={textareaRef}
        data-testid={testId}
        rows={1}
        value={value}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {hasMath(value) && (
        <p className="card-editor-math-preview" aria-label={`${label} preview`}>
          <MathText text={value} />
        </p>
      )}
      <div className="card-editor-caption-row">
        <label htmlFor={id} className="card-editor-caption">
          {label} <span className="sr-only">for card {cardNumber}</span>
        </label>
        <button
          type="button"
          className="card-editor-latex"
          onClick={insertFormula}
          aria-label={`Insert a LaTeX formula in the ${label.toLowerCase()} for card ${cardNumber}`}
          title="Insert a LaTeX formula: $x^2$ inline, $$...$$ for display"
        >
          ∑ LaTeX
        </button>
      </div>
    </div>
  )
}

interface CardRowEditorProps {
  readonly row: DraftRow
  readonly number: number
  readonly isLast: boolean
  readonly canDelete: boolean
  /** Warn that exactly one side is filled. */
  readonly incomplete: boolean
  /** When true the term field takes focus once (a freshly added row). */
  readonly focusTerm: boolean
  readonly onFocused: () => void
  readonly onChange: (patch: DraftRowPatch) => void
  readonly onDelete: () => void
  /** Tab out of the last row's definition: add a row (the parent focuses its term). */
  readonly onTabPastEnd: () => void
}

/** One numbered term/definition panel, Quizlet-style. */
export const CardRowEditor = ({
  row,
  number,
  isLast,
  canDelete,
  incomplete,
  focusTerm,
  onFocused,
  onChange,
  onDelete,
  onTabPastEnd,
}: CardRowEditorProps) => {
  const termRef = useRef<HTMLTextAreaElement>(null)
  const definitionRef = useRef<HTMLTextAreaElement>(null)
  const warningId = useId()

  useEffect(() => {
    if (!focusTerm) return
    termRef.current?.focus()
    onFocused()
  }, [focusTerm, onFocused])

  const handleDefinitionKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isLast && event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault()
      onTabPastEnd()
    }
  }

  const describedBy = incomplete ? warningId : undefined
  const termMissing = incomplete && row.term.trim().length === 0
  const definitionMissing = incomplete && row.definition.trim().length === 0

  return (
    <li className="card-editor" data-testid={TESTIDS.createCardRow}>
      <div className="card-editor-top">
        <span className="card-editor-number" aria-hidden="true">
          {number}
        </span>
        <button
          type="button"
          className="icon-button card-editor-delete"
          data-testid={TESTIDS.createDeleteCard}
          aria-label={`Delete card ${number}`}
          disabled={!canDelete}
          onClick={onDelete}
        >
          <DeleteIcon />
        </button>
      </div>
      <div className="card-editor-fields">
        <CardField
          label="Term"
          cardNumber={number}
          value={row.term}
          invalid={termMissing}
          describedBy={describedBy}
          testId={TESTIDS.createTerm}
          textareaRef={termRef}
          onChange={(term) => onChange({ term })}
        />
        <CardField
          label="Definition"
          cardNumber={number}
          value={row.definition}
          invalid={definitionMissing}
          describedBy={describedBy}
          testId={TESTIDS.createDefinition}
          textareaRef={definitionRef}
          onChange={(definition) => onChange({ definition })}
          onKeyDown={handleDefinitionKeyDown}
        />
      </div>
      <div className="card-editor-images">
        <CardImageSlot
          label="term image"
          context={`card ${number}`}
          value={row.termImage}
          onChange={(termImage) => onChange({ termImage })}
        />
        <CardImageSlot
          label="definition image"
          context={`card ${number}`}
          value={row.definitionImage}
          onChange={(definitionImage) => onChange({ definitionImage })}
        />
      </div>
      {incomplete && (
        <p id={warningId} className="field-error" role="alert">
          Card {number} needs both a term and a definition, or clear it to skip it.
        </p>
      )}
    </li>
  )
}
