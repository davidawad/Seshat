import { useRef, useState } from 'react'
import { useSeshatStore } from '../../lib/store'
import { type OcclusionRegion, type SetId, type StudyCard, cardContentSchema } from '../../types'
import { planDiagramCards, unlabeledRegionNumbers } from './diagram-model'
import type { DiagramDraft } from './use-diagram-editor'

/** The first thing wrong with a draft that stops it becoming cards, or null when it is ready. */
const draftProblem = (draft: DiagramDraft): string | null => {
  if (draft.title.trim() === '') return 'Give the diagram a title: it is the prompt on every card.'
  if (draft.image === null && draft.imageDataUrl === undefined) return 'Add an image first.'
  if (draft.regions.length === 0) return 'Draw at least one region.'
  const missing = unlabeledRegionNumbers(draft.regions)
  return missing.length > 0 ? `Label every region (missing: ${missing.join(', ')}).` : null
}

const existingCards = (cards: readonly StudyCard[]) =>
  cards.map((card) => ({
    cardId: card.id,
    askedRegionId: card.content.kind === 'image-occlusion' ? card.content.askedRegionId : undefined,
  }))

/** Turns the draft into one card per label (adds, updates, removals), asking before any removal. */
export const useDiagramSave = (setId: SetId, cards: readonly StudyCard[], draft: DiagramDraft, onDone: () => void) => {
  const { addCard, updateCard, deleteCard } = useSeshatStore()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const diagramId = useRef(
    cards.map((card) => (card.content.kind === 'image-occlusion' ? card.content.diagramId : undefined)).find(Boolean) ??
      crypto.randomUUID(),
  )
  const plan = planDiagramCards(draft.regions, existingCards(cards))

  const contentFor = (region: OcclusionRegion) => ({
    kind: 'image-occlusion' as const,
    image: draft.image,
    ...(draft.imageDataUrl === undefined ? {} : { imageDataUrl: draft.imageDataUrl }),
    occlusions: [...draft.regions],
    askedRegionId: region.id,
    diagramId: diagramId.current,
  })

  const apply = () => {
    const prompt = draft.title.trim()
    for (const { cardId, region } of plan.update) {
      updateCard(cardId as StudyCard['id'], { prompt, content: contentFor(region) })
    }
    for (const region of plan.add) {
      addCard(setId, {
        prompt,
        promptImage: null,
        content: contentFor(region),
        explanation: null,
        sourceRef: null,
        tags: [],
      })
    }
    for (const id of plan.remove) deleteCard(id as StudyCard['id'])
    onDone()
  }

  const save = () => {
    const problem = draftProblem(draft)
    const probe = problem === null ? cardContentSchema.safeParse(contentFor(draft.regions[0]!)) : null
    const message =
      problem ?? (probe !== null && !probe.success ? probe.error.issues.map((issue) => issue.message).join(' ') : null)
    setError(message)
    if (message !== null) return
    if (plan.remove.length > 0) setConfirming(true)
    else apply()
  }

  return { plan, error, confirming, cancelConfirm: () => setConfirming(false), save, apply }
}
