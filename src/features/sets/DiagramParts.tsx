import { useId } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import type { MediaRef } from '../../lib/media'
import { TESTIDS } from '../../lib/testids'
import { CardImageSlot } from './CardImageSlot'
import type { DiagramCardPlan } from './diagram-model'

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

interface DiagramImageFieldProps {
  readonly image: MediaRef | null
  readonly hasLegacyImage: boolean
  readonly onChange: (image: MediaRef | null) => void
}

/** Upload / replace / remove the diagram image, with its alt text (the slot's own field). */
export const DiagramImageField = ({ image, hasLegacyImage, onChange }: DiagramImageFieldProps) => (
  <div className="diagram-editor-field">
    <CardImageSlot label="diagram image" context="this diagram" value={image} onChange={onChange} />
    {image === null && hasLegacyImage && (
      <p className="field-hint">This diagram still uses an older embedded image; choose a new one to replace it.</p>
    )}
    <p className="field-hint">
      Alt text: describe the whole diagram for someone who cannot see it (what it shows, not the answers).
    </p>
  </div>
)

interface DiagramToolbarProps {
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly onAdd: () => void
  readonly onUndo: () => void
  readonly onRedo: () => void
}

export const DiagramToolbar = ({ canUndo, canRedo, onAdd, onUndo, onRedo }: DiagramToolbarProps) => (
  <div className="diagram-editor-toolbar" role="toolbar" aria-label="Diagram tools">
    <button type="button" data-testid={TESTIDS.diagramAddRegion} onClick={onAdd}>
      Add region
    </button>
    <button type="button" data-testid={TESTIDS.diagramUndo} disabled={!canUndo} onClick={onUndo}>
      Undo
    </button>
    <button type="button" data-testid={TESTIDS.diagramRedo} disabled={!canRedo} onClick={onRedo}>
      Redo
    </button>
  </div>
)

interface DiagramFooterProps {
  readonly regionCount: number
  readonly isNew: boolean
  readonly plan: DiagramCardPlan
  readonly error: string | null
  readonly confirming: boolean
  readonly onSave: () => void
  readonly onCancel: () => void
  readonly onConfirm: () => void
  readonly onCancelConfirm: () => void
}

/** The card count, any problem blocking the save, Save/Cancel, and the confirmation before cards are removed. */
export const DiagramFooter = ({
  regionCount,
  isNew,
  plan,
  error,
  confirming,
  onSave,
  onCancel,
  onConfirm,
  onCancelConfirm,
}: DiagramFooterProps) => {
  const confirmTitleId = useId()
  const change = isNew ? '' : ` (adds ${plan.add.length}, updates ${plan.update.length}, removes ${plan.remove.length})`
  return (
    <>
      <p className="field-hint" data-testid={TESTIDS.diagramCardCount}>
        {plural(regionCount, 'label')} = {plural(regionCount, 'card')}
        {change}
      </p>
      {error !== null && (
        <p role="alert" className="diagram-editor-error">
          {error}
        </p>
      )}
      <div className="diagram-editor-actions">
        <button type="button" data-testid={TESTIDS.diagramSave} onClick={onSave}>
          {isNew ? 'Create cards' : 'Save diagram'}
        </button>
        <button type="button" data-testid={TESTIDS.diagramCancel} onClick={onCancel}>
          Cancel
        </button>
      </div>
      {confirming && (
        <ConfirmDialog
          open
          titleId={confirmTitleId}
          title="Remove cards for deleted labels?"
          message={`Saving removes ${plural(plan.remove.length, 'card')} whose label was deleted, with their review history.`}
          confirmLabel="Save and remove"
          onConfirm={onConfirm}
          onCancel={onCancelConfirm}
        />
      )}
    </>
  )
}
