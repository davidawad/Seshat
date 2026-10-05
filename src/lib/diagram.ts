import type { ImageOcclusionContent, OcclusionRegion, StudyCard } from '../types'

/**
 * Pure helpers shared by every place a diagram (image-occlusion) card is
 * shown: study, flashcards, the set-page preview and the term list.
 */

const regionById = (content: ImageOcclusionContent, id: string | undefined): OcclusionRegion | undefined =>
  id === undefined ? undefined : content.occlusions.find((region) => region.id === id)

/**
 * The region a card asks about: `override` (a per-review pick for legacy
 * multi-region cards) when it exists, else the card's own `askedRegionId`,
 * else the first region. `occlusions` is schema-guaranteed non-empty.
 */
export const askedRegion = (content: ImageOcclusionContent, override?: string): OcclusionRegion =>
  regionById(content, override) ?? regionById(content, content.askedRegionId) ?? content.occlusions[0]!

/** What the question side hides: only the asked region, or every region when "Hide all labels" is on. */
export const maskedRegionIds = (
  regions: readonly Pick<OcclusionRegion, 'id'>[],
  askedId: string,
  hideAll: boolean,
): ReadonlySet<string> => new Set(hideAll ? regions.map((region) => region.id) : [askedId])

const band = (centrePct: number, names: readonly [string, string, string]): string =>
  centrePct < 100 / 3 ? names[0] : centrePct < 200 / 3 ? names[1] : names[2]

type Rect = Pick<OcclusionRegion, 'xPct' | 'yPct' | 'widthPct' | 'heightPct'>

/** A region's position as words ("upper left", "centre"), so it is identifiable without sight of the box. */
export const describePosition = (region: Rect): string => {
  const vertical = band(region.yPct + region.heightPct / 2, ['upper', 'middle', 'lower'])
  const horizontal = band(region.xPct + region.widthPct / 2, ['left', 'centre', 'right'])
  if (vertical === 'middle' && horizontal === 'centre') return 'centre'
  return vertical === 'middle' ? horizontal : horizontal === 'centre' ? vertical : `${vertical} ${horizontal}`
}

/** The accessible name of a diagram image: the author's alt text, else a generic one that carries the prompt. */
export const diagramAlt = (alt: string | undefined, prompt: string): string => {
  const own = alt?.trim() ?? ''
  if (own !== '') return own
  return prompt.trim() !== '' ? `Diagram for: ${prompt.trim()}` : 'Diagram'
}

export type CardListEntry =
  | { readonly kind: 'card'; readonly card: StudyCard }
  | { readonly kind: 'diagram'; readonly key: string; readonly cards: readonly StudyCard[] }

/**
 * Collapses the per-label cards of one diagram (same `diagramId`) into a single
 * list entry, in first-appearance order. A legacy image-occlusion card without
 * a `diagramId` is a diagram of one; every other card stays a plain entry.
 */
export const groupDiagramCards = (cards: readonly StudyCard[]): readonly CardListEntry[] => {
  const entries: CardListEntry[] = []
  const byDiagram = new Map<string, StudyCard[]>()
  for (const card of cards) {
    if (card.content.kind !== 'image-occlusion') {
      entries.push({ kind: 'card', card })
      continue
    }
    const key = card.content.diagramId ?? card.id
    const group = byDiagram.get(key)
    if (group === undefined) {
      const created = [card]
      byDiagram.set(key, created)
      entries.push({ kind: 'diagram', key, cards: created })
    } else {
      group.push(card)
    }
  }
  return entries
}
