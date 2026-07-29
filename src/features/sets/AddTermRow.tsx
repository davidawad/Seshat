import { type KeyboardEvent, useId, useRef, useState } from 'react'
import { useSeshatStore } from '../../lib/store'
import type { SetId } from '../../types'

interface AddTermRowProps {
  readonly setId: SetId
}

/** The permanent blank row at the bottom of the list — type a term, tab to
    the definition, press Enter (or tab away) to add it, and keep typing the
    next one. No other fields; that's the whole interaction. */
export const AddTermRow = ({ setId }: AddTermRowProps) => {
  const { addCard } = useSeshatStore()
  const [term, setTerm] = useState('')
  const [definition, setDefinition] = useState('')
  const termId = useId()
  const definitionId = useId()
  const termInputRef = useRef<HTMLInputElement>(null)
  // Re-focusing the term input below fires a synchronous blur on whatever
  // still held focus, which would otherwise re-enter commit() with the
  // (not-yet-re-rendered) pre-clear closure and add the card twice.
  const isCommittingRef = useRef(false)

  const commit = () => {
    if (isCommittingRef.current) return
    const trimmedTerm = term.trim()
    const trimmedDefinition = definition.trim()
    if (trimmedTerm.length === 0 || trimmedDefinition.length === 0) return
    isCommittingRef.current = true
    addCard(setId, {
      prompt: trimmedTerm,
      content: { kind: 'short-answer', answer: trimmedDefinition, acceptableAnswers: [] },
      explanation: null,
      sourceRef: null,
      tags: [],
    })
    setTerm('')
    setDefinition('')
    termInputRef.current?.focus()
    isCommittingRef.current = false
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    }
  }

  return (
    <li className="card-row">
      <label htmlFor={termId} className="sr-only">
        New term
      </label>
      <input
        id={termId}
        ref={termInputRef}
        type="text"
        className="card-row-input legible"
        placeholder="Term"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <label htmlFor={definitionId} className="sr-only">
        New definition
      </label>
      <input
        id={definitionId}
        type="text"
        className="card-row-input legible"
        placeholder="Definition"
        value={definition}
        onChange={(event) => setDefinition(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
      />
    </li>
  )
}
