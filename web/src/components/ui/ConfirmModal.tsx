import { useState } from 'react';
import { createPortal } from 'react-dom';

const SKIP_KEY = 'nexum.skipDeleteConfirm';

export function shouldSkipConfirm(): boolean {
  return localStorage.getItem(SKIP_KEY) === 'true';
}

interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ message, onConfirm, onCancel }: Props) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleConfirm = () => {
    if (dontShowAgain) localStorage.setItem(SKIP_KEY, 'true');
    onConfirm();
  };

  return createPortal(
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal confirm-modal">
        <div className="modal__header">
          <h2 className="modal__title">Are you sure?</h2>
        </div>
        <div className="modal__body">
          <p className="confirm-modal__message">{message}</p>
          <label className="confirm-modal__skip">
            <input
              type="checkbox"
              className="sig-checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            Don't show this again
          </label>
          <div className="modal__actions">
            <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
            <button className="btn btn--danger" onClick={handleConfirm}>Delete</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
