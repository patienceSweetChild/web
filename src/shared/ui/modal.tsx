"use client";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/** Reusable centered modal overlay used by board attach pickers and dialogs. */
export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div className="picker-backdrop open" onClick={onClose} role="presentation">
      <div
        className="picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{title}</h3>
        {children}
        {footer ?? (
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        )}
      </div>
    </div>
  );
}
