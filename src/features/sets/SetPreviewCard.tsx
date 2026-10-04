import { useCallback, useEffect, useMemo, useState } from 'react'
import { CardTip } from '../../components/CardTip'
import { FlipCard } from '../../components/FlipCard'
import { formatKeyLabel, matchesBinding } from '../../lib/keybindings'
import { TESTIDS } from '../../lib/testids'
import { useCardTip } from '../../lib/useCardTip'
import { useKeybindings } from '../../lib/useKeybindings'
import type { StudyCard } from '../../types'
import { cardFrontBack } from '../study/card-summary'

interface SetPreviewCardProps {
  readonly cards: readonly StudyCard[]
}

/** Elements that already own Space (activate / type), so the flip shortcut must leave them alone. */
const ownsSpace = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'SUMMARY'].includes(target.tagName))

/**
 * A single random card from the set, shown as a flip flashcard — the same
 * "get a feel for what's in here" preview Quizlet shows on a set's home
 * page. Purely a preview: no grading, no recordReview, nothing saved. The
 * attached card tip teaches the flip shortcut, which really works here.
 */
export const SetPreviewCard = ({ cards }: SetPreviewCardProps) => {
  const [flipped, setFlipped] = useState(false)
  const { key: keyFor } = useKeybindings()
  const flipKey = keyFor('flashcards.flip')
  // Fixed for the life of this page view — re-picking on every render would
  // make the card unreadable as you flip it.
  const card = useMemo(() => cards[Math.floor(Math.random() * cards.length)], [cards])
  // The tip teaches the flip, so the first flip (key or button) retires it.
  const tip = useCardTip('set-preview-flip')
  const { dismiss } = tip
  const toggle = useCallback(() => {
    setFlipped((current) => !current)
    dismiss()
  }, [dismiss])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat || ownsSpace(event.target) || document.querySelector('dialog[open]') !== null) return
      if (!matchesBinding(flipKey, event)) return
      event.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [flipKey, toggle])

  if (card === undefined) return null

  const { front, back, image, imageDataUrl } = cardFrontBack(card)

  return (
    <div className="set-preview">
      <FlipCard
        front={front}
        back={back}
        image={image}
        imageDataUrl={imageDataUrl}
        flipped={flipped}
        tip={
          <CardTip label="Tip" open={tip.open}>
            Press <kbd>{formatKeyLabel(flipKey)}</kbd> to flip the card
          </CardTip>
        }
      />
      <button type="button" data-testid={TESTIDS.setPreviewFlip} onClick={toggle}>
        {flipped ? 'Show term' : 'Show definition'}
      </button>
    </div>
  )
}
