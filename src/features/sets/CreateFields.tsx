import { type RefObject, useId } from 'react'
import { TESTIDS } from '../../lib/testids'
import { parseTagsInput } from './tags'

interface TitleFieldProps {
  readonly value: string
  readonly missing: boolean
  readonly inputRef: RefObject<HTMLInputElement | null>
  readonly onChange: (value: string) => void
}

/** The required title: a wide filled input with an inline, programmatically-linked error. */
export const TitleField = ({ value, missing, inputRef, onChange }: TitleFieldProps) => {
  const id = useId()
  const errorId = useId()
  return (
    <div className="set-create-field">
      <input
        id={id}
        ref={inputRef}
        type="text"
        data-testid={TESTIDS.createTitle}
        value={value}
        required
        aria-required="true"
        aria-invalid={missing}
        aria-describedby={missing ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      <label htmlFor={id} className="card-editor-caption">
        Title
      </label>
      {missing && (
        <p id={errorId} className="field-error" role="alert" data-testid={TESTIDS.createTitleError}>
          Enter a title for the set.
        </p>
      )}
    </div>
  )
}

interface PlainFieldProps {
  readonly value: string
  readonly onChange: (value: string) => void
}

export const DescriptionField = ({ value, onChange }: PlainFieldProps) => {
  const id = useId()
  return (
    <div className="set-create-field">
      <input
        id={id}
        type="text"
        data-testid={TESTIDS.createDescription}
        value={value}
        placeholder="Add a description…"
        onChange={(event) => onChange(event.target.value)}
      />
      <label htmlFor={id} className="card-editor-caption">
        Description (optional)
      </label>
    </div>
  )
}

/** Comma-separated tags typed as text, previewed as chips (same parsing as the set editor). */
export const TagsField = ({ value, onChange }: PlainFieldProps) => {
  const id = useId()
  const tags = parseTagsInput(value)
  return (
    <div className="set-create-field">
      <input
        id={id}
        type="text"
        data-testid={TESTIDS.createTags}
        value={value}
        placeholder="Add tags, separated by commas"
        onChange={(event) => onChange(event.target.value)}
      />
      <label htmlFor={id} className="card-editor-caption">
        Tags (optional)
      </label>
      {tags.length > 0 && (
        <ul className="tag-chips" aria-label="Tags">
          {tags.map((tag) => (
            <li key={tag} className="tag-chip">
              {tag}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
