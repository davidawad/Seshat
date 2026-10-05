import { useRef } from 'react'
import { TESTIDS } from '../lib/testids'
import { Modal } from './Modal'
import './confirm-dialog.css'

export interface ConfirmDialogProps {
  readonly open: boolean
  readonly titleId: string
  readonly title: string
  /** What will happen, in plain words (rendered as one paragraph). */
  readonly message: string
  /** Optional line naming the thing affected, shown set apart (long text wraps). */
  readonly detail?: string
  readonly confirmLabel: string
  readonly cancelLabel?: string
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

/**
 * An in-app replacement for `window.confirm`: native `<dialog>` (focus trap, Escape cancels, inert
 * page behind it) via `Modal`. Focus starts on the safe Cancel button, so a stray Enter or Space
 * never destroys anything; the destructive button must be reached on purpose.
 */
export const ConfirmDialog = ({
  open,
  titleId,
  title,
  message,
  detail,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const cancelRef = useRef<HTMLButtonElement>(null)
  return (
    <Modal
      open={open}
      onClose={onCancel}
      titleId={titleId}
      title={title}
      testId={TESTIDS.confirmDialog}
      closeTestId={TESTIDS.confirmDialogClose}
      initialFocusRef={cancelRef}
    >
      <p className="confirm-dialog-message">{message}</p>
      {detail !== undefined && <p className="confirm-dialog-detail">{detail}</p>}
      <div className="confirm-dialog-actions">
        <button type="button" ref={cancelRef} onClick={onCancel} data-testid={TESTIDS.confirmDialogCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className="confirm-dialog-danger"
          onClick={onConfirm}
          data-testid={TESTIDS.confirmDialogAccept}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
