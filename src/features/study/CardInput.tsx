import { useState } from 'react'
import { CardImage } from '../../components/CardImage'
import { Legible } from '../../components/Legible'
import { useSeshatStore } from '../../lib/store'
import type { StudyCard } from '../../types'
import { ClozeCard } from './ClozeCard'
import type { Attempt } from './grading'
import { ImageOcclusionCard } from './ImageOcclusionCard'
import { McqCard, McqOptions } from './McqCard'
import { ShortAnswerCard } from './ShortAnswerCard'

interface CardInputProps {
  readonly card: StudyCard
  readonly attempt: Attempt
  readonly onChange: (attempt: Attempt) => void
  readonly disabled: boolean
  /** A multiple-choice option was picked: the answer is complete and submitted at once (no Continue). */
  readonly onCommit?: (attempt: Attempt) => void
}

interface CardContentProps extends CardInputProps {
  readonly mcqOptionsShown: boolean
  readonly onShowMcqOptions: () => void
}

/**
 * One study card: the `.illuminated-panel` card (prompt image + the content-kind-specific input)
 * and, for a multiple-choice card, its options OUTSIDE the card, directly below it. The options
 * show at once unless Settings.mcqShowOptionsOnRequest is on, in which case the card carries a
 * "Show options" button until the learner presses it (or has already picked an option).
 */
export const CardInput = (props: CardInputProps) => {
  const {
    state: {
      settings: { mcqShowOptionsOnRequest },
    },
  } = useSeshatStore()
  const [requested, setRequested] = useState(false)
  const { card, attempt } = props
  const picked = attempt.kind === 'mcq' && attempt.selectedIndex !== null
  const optionsShown = !mcqShowOptionsOnRequest || requested || picked
  return (
    <>
      <Legible className="illuminated-panel study-panel">
        <CardImage image={card.promptImage} alt="" className="study-prompt-image" />
        <KindInput {...props} mcqOptionsShown={optionsShown} onShowMcqOptions={() => setRequested(true)} />
      </Legible>
      {card.content.kind === 'mcq' && optionsShown && (
        <McqOptions
          content={card.content}
          value={attempt.kind === 'mcq' ? attempt.selectedIndex : null}
          onPick={(selectedIndex) => {
            const picked: Attempt = { kind: 'mcq', selectedIndex }
            props.onChange(picked)
            props.onCommit?.(picked)
          }}
          disabled={props.disabled}
          focusFirst={requested && !picked}
        />
      )}
    </>
  )
}

/** Dispatches to the content-kind-specific card component, keeping `attempt` in sync with `card.content`. */
const KindInput = ({ card, attempt, onChange, disabled, mcqOptionsShown, onShowMcqOptions }: CardContentProps) => {
  switch (card.content.kind) {
    case 'short-answer':
      return (
        <ShortAnswerCard
          prompt={card.prompt}
          value={attempt.kind === 'short-answer' ? attempt.response : ''}
          onChange={(response) => onChange({ kind: 'short-answer', response })}
          disabled={disabled}
        />
      )
    case 'cloze':
      return (
        <ClozeCard
          prompt={card.prompt}
          content={card.content}
          value={attempt.kind === 'cloze' ? attempt.response : ''}
          onChange={(response) => onChange({ kind: 'cloze', response })}
          disabled={disabled}
        />
      )
    case 'mcq':
      return (
        <McqCard
          prompt={card.prompt}
          optionsShown={mcqOptionsShown}
          onShowOptions={onShowMcqOptions}
          disabled={disabled}
        />
      )
    case 'image-occlusion': {
      const targetRegionId =
        attempt.kind === 'image-occlusion' ? attempt.targetRegionId : (card.content.occlusions[0]?.id ?? '')
      return (
        <ImageOcclusionCard
          prompt={card.prompt}
          content={card.content}
          targetRegionId={targetRegionId}
          value={attempt.kind === 'image-occlusion' ? attempt.response : ''}
          onChange={(response) => onChange({ kind: 'image-occlusion', targetRegionId, response })}
          disabled={disabled}
        />
      )
    }
  }
}
