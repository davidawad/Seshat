import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export interface ModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly titleId: string
  readonly title: string
  readonly children: ReactNode
}

/**
 * A generic large modal dialog built on the native `<dialog>` element —
 * free focus trapping, Escape-to-close, and a `::backdrop` (styled in
 * index.css), no dialog library needed.
 */
export const Modal = ({ open, onClose, titleId, title, children }: ModalProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog === null) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click landing on the <dialog> element itself (not its content)
        // is a click on the backdrop area — close, same as clicking outside
        // any other modal.
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <div className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  )
}
