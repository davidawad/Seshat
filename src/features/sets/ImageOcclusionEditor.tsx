import { type ChangeEvent, type PointerEvent as ReactPointerEvent, useId, useRef, useState } from 'react'
import type { OcclusionRegion } from '../../types'
import { downscaleImageFile, isImageDataUrlOversized } from './image-processing'
import './image-occlusion-editor.css'
import { clientPointToPct, isRegionRectSignificant, type PointPct, rectFromPoints } from './region-geometry'

export interface ImageOcclusionDraft {
  readonly imageDataUrl: string
  readonly occlusions: OcclusionRegion[]
}

interface ImageOcclusionEditorProps {
  readonly value: ImageOcclusionDraft
  readonly onChange: (next: ImageOcclusionDraft) => void
}

/** A newly-added region's default rect, offset per existing region so repeated additions don't stack exactly on top of each other. */
const defaultRegionRect = (existingCount: number) => {
  const offset = (existingCount * 8) % 50
  return { xPct: 10 + offset, yPct: 10 + offset, widthPct: 25, heightPct: 15 }
}

const round1 = (value: number): number => Math.round(value * 10) / 10

/**
 * Upload + region editor for image-occlusion cards. Drawing a box (pointer
 * down -> drag -> up) is the primary way to add a region, but every region
 * also gets numeric x/y/width/height fields so the whole editor stays
 * keyboard-operable — a keyboard-only user can add a region with the
 * "Add region" button and place it precisely with the number inputs,
 * without ever needing to drag.
 */
export const ImageOcclusionEditor = ({ value, onChange }: ImageOcclusionEditorProps) => {
  const [processingError, setProcessingError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [draftRect, setDraftRect] = useState<{ readonly a: PointPct; readonly b: PointPct } | null>(null)
  const dragOrigin = useRef<PointPct | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const fileInputId = useId()
  const regionBaseId = useId()

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file === undefined) return

    setProcessingError(null)
    setIsProcessing(true)
    downscaleImageFile(file)
      .then((imageDataUrl) => {
        // A new image invalidates any existing regions (they were labeled
        // for the previous image), so start the region list over.
        onChange({ imageDataUrl, occlusions: [] })
      })
      .catch((error: unknown) => {
        setProcessingError(error instanceof Error ? error.message : 'Could not process the selected image.')
      })
      .finally(() => {
        setIsProcessing(false)
      })
  }

  const addRegion = (rect: { xPct: number; yPct: number; widthPct: number; heightPct: number }, label = '') => {
    const region: OcclusionRegion = {
      id: crypto.randomUUID(),
      xPct: round1(rect.xPct),
      yPct: round1(rect.yPct),
      widthPct: round1(rect.widthPct),
      heightPct: round1(rect.heightPct),
      label,
    }
    onChange({ ...value, occlusions: [...value.occlusions, region] })
  }

  const updateRegion = (id: string, patch: Partial<OcclusionRegion>) => {
    onChange({
      ...value,
      occlusions: value.occlusions.map((region) => (region.id === id ? { ...region, ...patch } : region)),
    })
  }

  const removeRegion = (id: string) => {
    onChange({ ...value, occlusions: value.occlusions.filter((region) => region.id !== id) })
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (value.imageDataUrl === '') return
    const bounds = event.currentTarget.getBoundingClientRect()
    const point = clientPointToPct(event.clientX, event.clientY, bounds)
    dragOrigin.current = point
    setDraftRect({ a: point, b: point })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragOrigin.current === null) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const point = clientPointToPct(event.clientX, event.clientY, bounds)
    setDraftRect({ a: dragOrigin.current, b: point })
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragOrigin.current === null) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const point = clientPointToPct(event.clientX, event.clientY, bounds)
    const rect = rectFromPoints(dragOrigin.current, point)
    dragOrigin.current = null
    setDraftRect(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (isRegionRectSignificant(rect)) {
      addRegion(rect)
    }
  }

  const drawnRect = draftRect === null ? null : rectFromPoints(draftRect.a, draftRect.b)
  const oversized = value.imageDataUrl !== '' && isImageDataUrlOversized(value.imageDataUrl)

  return (
    <div className="occlusion-editor">
      <div className="occlusion-editor-upload">
        <label htmlFor={fileInputId}>Image</label>
        <input id={fileInputId} type="file" accept="image/*" onChange={handleFileChange} />
        {isProcessing && <p role="status">Processing image…</p>}
        {processingError !== null && (
          <p role="alert" className="occlusion-editor-error">
            {processingError}
          </p>
        )}
        {oversized && (
          <p role="status" className="occlusion-editor-warning">
            This image is large even after compression, which eats into the shared localStorage budget faster than
            text-only cards. It will still save — consider a smaller or simpler source image if you plan to add many of
            these.
          </p>
        )}
      </div>

      {value.imageDataUrl !== '' && (
        <>
          <p className="field-hint">
            Drag on the image to draw a region, or use &ldquo;Add region&rdquo; below and set its position with the
            number fields.
          </p>
          <div
            ref={wrapRef}
            className="occlusion-editor-image-wrap"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <img src={value.imageDataUrl} alt="" className="occlusion-editor-image" />
            {value.occlusions.map((region) => (
              <span
                key={region.id}
                className="occlusion-editor-region"
                style={{
                  left: `${region.xPct}%`,
                  top: `${region.yPct}%`,
                  width: `${region.widthPct}%`,
                  height: `${region.heightPct}%`,
                }}
              >
                {region.label !== '' ? region.label : '(unlabeled)'}
              </span>
            ))}
            {drawnRect !== null && (
              <span
                className="occlusion-editor-draft-region"
                style={{
                  left: `${drawnRect.xPct}%`,
                  top: `${drawnRect.yPct}%`,
                  width: `${drawnRect.widthPct}%`,
                  height: `${drawnRect.heightPct}%`,
                }}
              />
            )}
          </div>

          <button type="button" onClick={() => addRegion(defaultRegionRect(value.occlusions.length))}>
            Add region
          </button>

          {value.occlusions.length === 0 && <p className="field-hint">At least one labeled region is required.</p>}

          <ul className="occlusion-editor-region-list">
            {value.occlusions.map((region, index) => {
              const labelId = `${regionBaseId}-${region.id}-label`
              const xId = `${regionBaseId}-${region.id}-x`
              const yId = `${regionBaseId}-${region.id}-y`
              const widthId = `${regionBaseId}-${region.id}-width`
              const heightId = `${regionBaseId}-${region.id}-height`
              return (
                <li key={region.id} className="occlusion-editor-region-item">
                  <div>
                    <label htmlFor={labelId}>Region {index + 1} label (what&rsquo;s hidden here)</label>
                    <input
                      id={labelId}
                      type="text"
                      value={region.label}
                      onChange={(event) => updateRegion(region.id, { label: event.target.value })}
                      required
                    />
                  </div>
                  <div className="occlusion-editor-region-coords">
                    <label htmlFor={xId}>
                      X %
                      <input
                        id={xId}
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={region.xPct}
                        onChange={(event) => updateRegion(region.id, { xPct: Number(event.target.value) })}
                      />
                    </label>
                    <label htmlFor={yId}>
                      Y %
                      <input
                        id={yId}
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={region.yPct}
                        onChange={(event) => updateRegion(region.id, { yPct: Number(event.target.value) })}
                      />
                    </label>
                    <label htmlFor={widthId}>
                      Width %
                      <input
                        id={widthId}
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={region.widthPct}
                        onChange={(event) => updateRegion(region.id, { widthPct: Number(event.target.value) })}
                      />
                    </label>
                    <label htmlFor={heightId}>
                      Height %
                      <input
                        id={heightId}
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={region.heightPct}
                        onChange={(event) => updateRegion(region.id, { heightPct: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                  <button type="button" onClick={() => removeRegion(region.id)}>
                    Remove region {index + 1}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
