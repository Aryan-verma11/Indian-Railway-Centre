import { useEffect, useRef } from 'react';

export default function ConfirmDialog({ open, title, children, confirmLabel, danger, busy, onConfirm, onCancel }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={dialogRef} className="dialog" onCancel={(event) => { event.preventDefault(); onCancel(); }}>
      <h2>{title}</h2>
      <div>{children}</div>
      <div className="dialog-actions">
        <button type="button" className="button" onClick={onCancel} disabled={busy} autoFocus>Cancel</button>
        <button type="button" className={`button ${danger ? 'button-danger' : 'button-primary'}`} onClick={onConfirm} disabled={busy}>
          {busy ? 'Please wait...' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
