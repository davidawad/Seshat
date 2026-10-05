import { type KeyboardEvent as ReactKeyboardEvent, useId } from 'react'
import { Legible } from '../../components/Legible'
import { diagramAlt } from '../../lib/diagram'
import { useSeshatStore } from '../../lib/store'
import { TESTIDS } from '../../lib/testids'
import type { OcclusionRegion, SetId, StudyCard } from '../../types'
import { DiagramCanvas } from './DiagramCanvas'
import { DiagramFooter, DiagramImageField, DiagramToolbar } from './DiagramParts'
import { DiagramPreviews, DiagramRegionList } from './DiagramRegionList'
import { useDiagramEditor } from './use-diagram-editor'
import { useDiagramSave } from './use-diagram-save'
import './diagram-editor.css'

interface DiagramEditorProps {
  readonly setId: SetId
  /** The diagram's existing cards (empty when creating one); one card per label. */
  readonly cards: readonly StudyCard[]
  readonly onDone: () => void
}

/**
 * Editor for a labelled diagram: upload an image, draw / drag / resize rectangles (every gesture has a
 * keyboard equivalent: Tab to a region, arrows move, Shift+arrows resize, Ctrl/Cmd x5, Delete removes),
 * label each one, undo/redo, and see the question and answer sides live. Saving makes one FSRS card per
 * label and keeps existing cards (and their history) when their region survives.
 */
export const DiagramEditor = ({ setId, cards, onDone }: DiagramEditorProps) => {
  const { state } = useSeshatStore()
  const editor = useDiagramEditor(cards)
  const { draft } = editor
  const saver = useDiagramSave(setId, cards, draft, onDone)
  const titleId = useId()
  const hintId = useId()
  const alt = diagramAlt(draft.image?.alt, draft.title)
  const selected = draft.regions.find((region) => region.id === editor.selectedId) ?? draft.regions[0]

  const handleRegionKey = (region: OcclusionRegion, event: ReactKeyboardEvent<HTMLElement>) => {
    const mods = { shift: event.shiftKey, large: event.ctrlKey || event.metaKey }
    if (!editor.handleRegionKey(region, event.key, mods)) return
    event.preventDefault()
    event.stopPropagation()
  }

  // Ctrl/Cmd+Z undoes and +Shift redoes, except in text fields where the browser's own undo applies.
  const handleEditorKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
    if (typing || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return
    event.preventDefault()
    if (event.shiftKey) editor.redo()
    else editor.undo()
  }

  return (
    <section
      className="diagram-editor"
      aria-label="Diagram editor"
      data-testid={TESTIDS.diagramEditor}
      onKeyDown={handleEditorKeyDown}
    >
      <div className="diagram-editor-field">
        <label htmlFor={titleId}>Diagram title (the prompt on every card)</label>
        <Legible as="span" measure={false}>
          <input
            id={titleId}
            type="text"
            value={draft.title}
            onChange={(event) => editor.setTitle(event.target.value)}
            required
          />
        </Legible>
      </div>
      <DiagramImageField
        image={draft.image}
        hasLegacyImage={draft.imageDataUrl !== undefined}
        onChange={editor.setImage}
      />

      {editor.hasImage && (
        <>
          <DiagramToolbar
            canUndo={editor.canUndo}
            canRedo={editor.canRedo}
            onAdd={editor.addDefaultRegion}
            onUndo={editor.undo}
            onRedo={editor.redo}
          />
          <p id={hintId} className="field-hint">
            Drag on the image to draw a region; drag a region to move it, or its corners to resize. With the keyboard:
            Tab to a region, arrow keys move it, Shift plus arrows resize it, Delete removes it (hold Ctrl or Cmd for
            bigger steps). Ctrl or Cmd plus Z undoes, plus Shift redoes.
          </p>
          <DiagramCanvas
            draft={draft}
            alt={alt}
            describedBy={hintId}
            selectedId={selected?.id}
            focusRequest={editor.focusRequest}
            onFocusHandled={editor.clearFocusRequest}
            onSelect={editor.setSelectedId}
            onDraw={editor.addRegion}
            onRectChange={(id, rect) => editor.setRegionRect(id, rect)}
            onRegionKey={handleRegionKey}
          />
          <p role="status" className="sr-only">
            {editor.status}
          </p>
          {draft.regions.length === 0 && <p className="field-hint">No regions yet: draw one or press Add region.</p>}
          <DiagramRegionList
            regions={draft.regions}
            onSelect={editor.setSelectedId}
            onLabel={editor.setLabel}
            onDelete={editor.removeRegion}
          />
          {selected !== undefined && (
            <DiagramPreviews
              draft={draft}
              alt={alt}
              askedId={selected.id}
              hideAll={state.settings.diagramHideAllLabels}
            />
          )}
        </>
      )}

      <DiagramFooter
        regionCount={draft.regions.length}
        isNew={cards.length === 0}
        plan={saver.plan}
        error={saver.error}
        confirming={saver.confirming}
        onSave={saver.save}
        onCancel={onDone}
        onConfirm={saver.apply}
        onCancelConfirm={saver.cancelConfirm}
      />
    </section>
  )
}
