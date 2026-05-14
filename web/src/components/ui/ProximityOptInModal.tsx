import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { notifyPermissionChanged } from '../../hooks/useNotificationPermission';

const ASKED_KEY = 'nexum.proximityOptInAsked';

/**
 * One-time consent modal shown on first login asking whether to enable
 * desktop notifications for proximity alerts (incursions / insurgencies).
 *
 * Skipped if:
 *  - The browser doesn't support the Notification API
 *  - Permission is already granted or already denied
 *  - The user has already responded to this prompt (tracked in localStorage)
 */
export function ProximityOptInModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default')  return;
    if (localStorage.getItem(ASKED_KEY))         return;
    setShow(true);
  }, []);

  function dismiss() {
    localStorage.setItem(ASKED_KEY, '1');
    setShow(false);
  }

  function enable() {
    // requestPermission can resolve with 'default' if the user dismisses the
    // OS prompt without choosing. Either way, mark as asked so we don't ask
    // again on every load. Also broadcast so the Map Options sidebar's
    // "Enable" button flips to "Enabled" immediately.
    Notification.requestPermission().finally(() => {
      notifyPermissionChanged();
      dismiss();
    });
  }

  if (!show) return null;

  return createPortal(
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal__header">
          <h2 className="modal__title">Enable threat alerts?</h2>
        </div>

        <div className="modal__body proximity-optin__body">
          <p>
            New Eden is a dangerous place. Nexum can give you a desktop notification and
            a short audio ping when you’re within a few jumps of an active <strong>incursion</strong>
            {' '}or <strong>insurgency</strong> — so you don’t blindly autopilot into one.
          </p>
          <p className="proximity-optin__sub">
            You can change the threshold or turn this off at any time in <em>Map Options →
            Proximity Alerts</em>.
          </p>

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={dismiss}>
              Maybe later
            </button>
            <button type="button" className="btn btn--primary" onClick={enable}>
              Enable notifications
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
