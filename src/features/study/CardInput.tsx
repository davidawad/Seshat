import { CardImage } from '../../components/CardImage'
import type { StudyCard } from '../../types'
import { ClozeCard } from './ClozeCard'
import type { Attempt } from './grading'
import { ImageOcclusionCard } from './ImageOcclusionCard'
import { McqCard } from './McqCard'
import { ShortAnswerCard } from './ShortAnswerCard'

interface CardInputProps {
  readonly card: StudyCard
  readonly attempt: Attempt
  readonly onChange: (attempt: Attempt) => void
  readonly disabled: boolean
}

/** The card's prompt image (if any) above the content-kind-specific input. */
export const CardInput = (props: CardInputProps) => (
  <>
    <CardImage image={props.card.promptImage} alt="" className="study-prompt-image" />
    <KindInput {...props} />
  </>
)

/** Dispatches to the content-kind-specific card component, keeping `attempt` in sync with `card.content`. */
const KindInput = ({ card, attempt, onChange, disabled }: CardInputProps) => {
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
          content={card.content}
          value={attempt.kind === 'mcq' ? attempt.selectedIndex : null}
          onChange={(selectedIndex) => onChange({ kind: 'mcq', selectedIndex })}
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
