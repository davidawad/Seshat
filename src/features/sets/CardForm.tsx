import { type FormEvent, useId, useState } from 'react'
import { Combobox } from '../../components/Combobox'
import { Legible } from '../../components/Legible'
import { useSeshatStore } from '../../lib/store'
import { type CardContent, type OcclusionRegion, type SetId, type StudyCard, cardContentSchema } from '../../types'
import { ImageOcclusionEditor } from './ImageOcclusionEditor'
import { parseTagsInput } from './tags'

type ContentKind = CardContent['kind']

const KIND_OPTIONS: readonly { readonly value: ContentKind; readonly label: string }[] = [
  { value: 'short-answer', label: 'Short answer' },
  { value: 'cloze', label: 'Cloze (fill in the blank)' },
  { value: 'mcq', label: 'Multiple choice' },
  { value: 'image-occlusion', label: 'Image occlusion' },
]

interface CardFormProps {
  readonly setId: SetId
  /** null = create a new card; otherwise edit this existing card. */
  readonly editingCard: StudyCard | null
  readonly onDone: () => void
}

const splitLines = (raw: string): string[] =>
  raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

const draftFromContent = (content: CardContent | null) => ({
  kind: (content?.kind ?? 'short-answer') as ContentKind,
  answer: content?.kind === 'short-answer' ? content.answer : '',
  acceptableAnswersText: content?.kind === 'short-answer' ? content.acceptableAnswers.join('\n') : '',
  clozeText: content?.kind === 'cloze' ? content.text : '',
  options: content?.kind === 'mcq' ? content.options : ['', ''],
  correctIndex: content?.kind === 'mcq' ? content.correctIndex : 0,
  imageDataUrl: content?.kind === 'image-occlusion' ? content.imageDataUrl : '',
  occlusions: (content?.kind === 'image-occlusion' ? content.occlusions : []) as OcclusionRegion[],
})

export const CardForm = ({ setId, editingCard, onDone }: CardFormProps) => {
  const { addCard, updateCard } = useSeshatStore()
  const [prompt, setPrompt] = useState(editingCard?.prompt ?? '')
  const [explanation, setExplanation] = useState(editingCard?.explanation ?? '')
  const [sourceRef, setSourceRef] = useState(editingCard?.sourceRef ?? '')
  const [tagsText, setTagsText] = useState(editingCard?.tags.join(', ') ?? '')
  const [draft, setDraft] = useState(() => draftFromContent(editingCard?.content ?? null))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const promptId = useId()
  const explanationId = useId()
  const sourceRefId = useId()
  const tagsId = useId()
  const kindId = useId()
  const answerId = useId()
  const acceptableId = useId()
  const clozeId = useId()
  const promptErrorId = useId()
  const contentErrorId = useId()

  const setKind = (kind: ContentKind) => {
    setDraft((prev) => ({ ...prev, kind }))
  }

  const setOption = (index: number, value: string) => {
    setDraft((prev) => ({ ...prev, options: prev.options.map((option, i) => (i === index ? value : option)) }))
  }

  const addOption = () => {
    setDraft((prev) => ({ ...prev, options: [...prev.options, ''] }))
  }

  const removeOption = (index: number) => {
    setDraft((prev) => {
      const options = prev.options.filter((_, i) => i !== index)
      const correctIndex = prev.correctIndex >= options.length ? Math.max(0, options.length - 1) : prev.correctIndex
      return { ...prev, options, correctIndex }
    })
  }

  const buildContent = (): CardContent => {
    switch (draft.kind) {
      case 'short-answer':
        return {
          kind: 'short-answer',
          answer: draft.answer.trim(),
          acceptableAnswers: splitLines(draft.acceptableAnswersText),
        }
      case 'cloze':
        return { kind: 'cloze', text: draft.clozeText.trim() }
      case 'mcq':
        return {
          kind: 'mcq',
          options: draft.options.map((option) => option.trim()),
          correctIndex: draft.correctIndex,
        }
      case 'image-occlusion':
        return {
          kind: 'image-occlusion',
          imageDataUrl: draft.imageDataUrl,
          occlusions: draft.occlusions,
        }
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}

    const trimmedPrompt = prompt.trim()
    if (trimmedPrompt.length === 0) {
      nextErrors['prompt'] = 'Prompt is required.'
    }

    const content = buildContent()
    const parsedContent = cardContentSchema.safeParse(content)
    if (!parsedContent.success) {
      nextErrors['content'] = parsedContent.error.issues.map((issue) => issue.message).join(' ')
    } else if (content.kind === 'mcq' && (content.correctIndex < 0 || content.correctIndex >= content.options.length)) {
      nextErrors['content'] = 'Select which option is correct.'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const input = {
      prompt: trimmedPrompt,
      content,
      explanation: explanation.trim().length > 0 ? explanation.trim() : null,
      sourceRef: sourceRef.trim().length > 0 ? sourceRef.trim() : null,
      tags: parseTagsInput(tagsText),
    }

    if (editingCard === null) {
      addCard(setId, input)
    } else {
      updateCard(editingCard.id, input)
    }
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} aria-label={editingCard === null ? 'Add card' : 'Edit card'}>
      <div>
        <label htmlFor={promptId}>Prompt</label>
        <Legible as="span" measure={false}>
          <input
            id={promptId}
            type="text"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            aria-invalid={errors['prompt'] !== undefined}
            aria-describedby={errors['prompt'] !== undefined ? promptErrorId : undefined}
            required
          />
        </Legible>
        {errors['prompt'] !== undefined && (
          <p id={promptErrorId} role="alert">
            {errors['prompt']}
          </p>
        )}
      </div>

      <fieldset>
        <legend>Card type</legend>
        <label htmlFor={kindId}>Kind</label>
        <Combobox id={kindId} value={draft.kind} onChange={setKind} options={KIND_OPTIONS} />
      </fieldset>

      {draft.kind === 'short-answer' && (
        <div>
          <div>
            <label htmlFor={answerId}>Answer</label>
            <Legible as="span" measure={false}>
              <input
                id={answerId}
                type="text"
                value={draft.answer}
                onChange={(event) => setDraft((prev) => ({ ...prev, answer: event.target.value }))}
                required
              />
            </Legible>
          </div>
          <div>
            <label htmlFor={acceptableId}>Other acceptable answers (one per line, optional)</label>
            <Legible as="div" measure={false}>
              <textarea
                id={acceptableId}
                value={draft.acceptableAnswersText}
                onChange={(event) => setDraft((prev) => ({ ...prev, acceptableAnswersText: event.target.value }))}
                rows={3}
              />
            </Legible>
          </div>
        </div>
      )}

      {draft.kind === 'cloze' && (
        <div>
          <label htmlFor={clozeId}>Text, with the deletion wrapped in double curly braces</label>
          <p id={`${clozeId}-hint`}>
            Example: &quot;The mitochondria is the {'{{'}powerhouse of the cell{'}}'}.&quot;
          </p>
          <Legible as="div" measure={false}>
            <textarea
              id={clozeId}
              aria-describedby={`${clozeId}-hint`}
              value={draft.clozeText}
              onChange={(event) => setDraft((prev) => ({ ...prev, clozeText: event.target.value }))}
              rows={3}
              required
            />
          </Legible>
        </div>
      )}

      {draft.kind === 'mcq' && (
        <fieldset>
          <legend>Options (select the correct one)</legend>
          {draft.options.map((option, index) => {
            const optionId = `${kindId}-option-${index}`
            return (
              <div key={optionId}>
                <label htmlFor={optionId}>Option {index + 1}</label>
                <Legible as="span" measure={false}>
                  <input
                    id={optionId}
                    type="text"
                    value={option}
                    onChange={(event) => setOption(index, event.target.value)}
                    required
                  />
                </Legible>
                <label>
                  <input
                    type="radio"
                    name={`${kindId}-correct`}
                    checked={draft.correctIndex === index}
                    onChange={() => setDraft((prev) => ({ ...prev, correctIndex: index }))}
                  />
                  Correct
                </label>
                {draft.options.length > 2 && (
                  <button type="button" onClick={() => removeOption(index)}>
                    Remove option {index + 1}
                  </button>
                )}
              </div>
            )
          })}
          <button type="button" onClick={addOption}>
            Add option
          </button>
        </fieldset>
      )}

      {draft.kind === 'image-occlusion' && (
        <fieldset>
          <legend>Image and regions</legend>
          <ImageOcclusionEditor
            value={{ imageDataUrl: draft.imageDataUrl, occlusions: draft.occlusions }}
            onChange={({ imageDataUrl, occlusions }) => setDraft((prev) => ({ ...prev, imageDataUrl, occlusions }))}
          />
        </fieldset>
      )}

      {errors['content'] !== undefined && (
        <p id={contentErrorId} role="alert">
          {errors['content']}
        </p>
      )}

      <div>
        <label htmlFor={explanationId}>Explanation (optional)</label>
        <Legible as="div" measure={false}>
          <textarea
            id={explanationId}
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
            rows={2}
          />
        </Legible>
      </div>

      <div>
        <label htmlFor={sourceRefId}>Source reference (optional)</label>
        <input id={sourceRefId} type="text" value={sourceRef} onChange={(event) => setSourceRef(event.target.value)} />
      </div>

      <div>
        <label htmlFor={tagsId}>Tags (comma-separated, optional)</label>
        <input id={tagsId} type="text" value={tagsText} onChange={(event) => setTagsText(event.target.value)} />
      </div>

      <div>
        <button type="submit">{editingCard === null ? 'Add card' : 'Save changes'}</button>
        <button type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  )
}
