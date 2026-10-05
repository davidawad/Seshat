import { useState } from 'react'
import type { MediaRef } from '../../lib/media'
import type { OcclusionRegion, StudyCard } from '../../types'
import {
  type History,
  applyKeyEdit,
  canRedo,
  canUndo,
  clampRect,
  commit,
  createHistory,
  defaultRegionRect,
  describeRegionRect,
  keyToEdit,
  redo,
  regionRect,
  undo,
} from './diagram-model'
import type { RectPct } from './region-geometry'

export interface DiagramDraft {
  readonly title: string
  readonly image: MediaRef | null
  /** LEGACY inline data URL of a not-yet-migrated card; dropped as soon as a new image is chosen. */
  readonly imageDataUrl: string | undefined
  readonly regions: readonly OcclusionRegion[]
}

/** Where to put keyboard focus after an edit: a region, or the canvas itself (`id: null`). */
export interface FocusRequest {
  readonly id: string | null
}

export const draftFrom = (cards: readonly StudyCard[]): DiagramDraft => {
  const first = cards[0]
  if (first === undefined || first.content.kind !== 'image-occlusion') {
    return { title: '', image: null, imageDataUrl: undefined, regions: [] }
  }
  return {
    title: first.prompt,
    image: first.content.image,
    imageDataUrl: first.content.imageDataUrl,
    regions: first.content.occlusions,
  }
}

const withRegion = (
  regions: readonly OcclusionRegion[],
  id: string,
  patch: Partial<OcclusionRegion>,
): readonly OcclusionRegion[] => regions.map((region) => (region.id === id ? { ...region, ...patch } : region))

/** The editor's whole state: the draft with its undo history, the selection, and what to announce. */
export const useDiagramEditor = (cards: readonly StudyCard[]) => {
  const [history, setHistory] = useState<History<DiagramDraft>>(() => createHistory(draftFrom(cards)))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)
  const draft = history.present

  const change = (next: DiagramDraft, key: string | null = null) => setHistory((h) => commit(h, next, key))
  const numberOf = (id: string) => draft.regions.findIndex((region) => region.id === id) + 1

  const addRegion = (rect: RectPct) => {
    const region: OcclusionRegion = { id: crypto.randomUUID(), ...clampRect(rect), label: '' }
    change({ ...draft, regions: [...draft.regions, region] })
    setSelectedId(region.id)
    setFocusRequest({ id: region.id })
    setStatus(`Region ${draft.regions.length + 1} added, ${describeRegionRect(region)}. Label it below.`)
  }

  const addDefaultRegion = () => addRegion(defaultRegionRect(draft.regions.length))

  const removeRegion = (id: string) => {
    const index = draft.regions.findIndex((region) => region.id === id)
    const rest = draft.regions.filter((region) => region.id !== id)
    change({ ...draft, regions: rest })
    const neighbour = rest[Math.min(index, rest.length - 1)]
    setSelectedId(neighbour?.id ?? null)
    setFocusRequest({ id: neighbour?.id ?? null })
    setStatus(`Region ${index + 1} removed. ${rest.length} left.`)
  }

  /** A finished pointer gesture or keyboard nudge; nudges share a key so a held arrow is one undo step. */
  const setRegionRect = (id: string, rect: RectPct, key: string | null = null) => {
    change({ ...draft, regions: withRegion(draft.regions, id, rect) }, key)
    setStatus(`Region ${numberOf(id)}: ${describeRegionRect(rect)}.`)
  }

  const setLabel = (id: string, label: string) =>
    change({ ...draft, regions: withRegion(draft.regions, id, { label }) }, `label:${id}`)

  /** Handles a key on a focused region; returns whether the key was an edit (so the caller can preventDefault). */
  const handleRegionKey = (
    region: OcclusionRegion,
    key: string,
    mods: { readonly shift: boolean; readonly large: boolean },
  ): boolean => {
    const edit = keyToEdit(key, mods)
    if (edit === null) return false
    if (edit.kind === 'delete') removeRegion(region.id)
    else setRegionRect(region.id, applyKeyEdit(regionRect(region), edit), `nudge:${region.id}`)
    return true
  }

  return {
    draft,
    hasImage: draft.image !== null || draft.imageDataUrl !== undefined,
    selectedId,
    setSelectedId,
    status,
    focusRequest,
    clearFocusRequest: () => setFocusRequest(null),
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    undo: () => setHistory(undo),
    redo: () => setHistory(redo),
    setTitle: (title: string) => change({ ...draft, title }, 'title'),
    setImage: (image: MediaRef | null) =>
      change({ ...draft, image, imageDataUrl: image === null ? draft.imageDataUrl : undefined }),
    addRegion,
    addDefaultRegion,
    removeRegion,
    setRegionRect,
    setLabel,
    handleRegionKey,
  }
}
