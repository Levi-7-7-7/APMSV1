/**
 * NotificationPermissionBanner — small dismissible strip nudging the
 * student/tutor to turn on push notifications (new certificate uploaded,
 * approved/rejected, ticket updates).
 *
 * Renders in one of two states, both gated on isPushCapable() and on the
 * user not having dismissed it before on this device:
 *   - permission === 'default'  → "Enable" button (normal opt-in nudge)
 *   - permission === 'denied'   → info-only message pointing at browser
 *     settings, since a page can never re-trigger the native permission
 *     dialog once the user has blocked it — the previous version of this
 *     banner just silently disappeared here, which looked like a bug
 *     rather than an expected browser restriction.
 *
 * Requesting permission MUST happen from a user gesture, hence the button
 * rather than an automatic prompt on mount.
 *
 * Usage:
 *   <NotificationPermissionBanner role="student" />
 *   <NotificationPermissionBanner role="tutor" />
 */
import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { isPushCapable, getPermissionState, registerPushNotifications } from '../utils/pushNotifications';
import '../css/NotificationPermissionBanner.css';

const DISMISS_KEY = 'pushPromptDismissed';
const BLOCKED_DISMISS_KEY = 'pushBlockedNoticeDismissed';

export default function NotificationPermissionBanner({ role }) {
  // 'default' → show the opt-in nudge; 'denied' → show the blocked notice;
  // null → capable/dismissed/granted, render nothing.
  const [mode, setMode] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | asking | error

  useEffect(() => {
    const capable = isPushCapable();
    if (!capable) return;

    const permission = getPermissionState();

    if (permission === 'default' && localStorage.getItem(DISMISS_KEY) !== 'true') {
      setMode('default');
    } else if (permission === 'denied' && localStorage.getItem(BLOCKED_DISMISS_KEY) !== 'true') {
      setMode('denied');
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(mode === 'denied' ? BLOCKED_DISMISS_KEY : DISMISS_KEY, 'true');
    setMode(null);
  };

  const enable = async () => {
    setStatus('asking');
    const result = await registerPushNotifications(role);

    if (result === 'enabled') {
      localStorage.setItem(DISMISS_KEY, 'true');
      setMode(null);
    } else if (result === 'denied') {
      // The user just blocked it in the native dialog — switch straight
      // to the blocked-state message instead of vanishing.
      localStorage.setItem(DISMISS_KEY, 'true');
      setStatus('idle');
      setMode('denied');
    } else if (result === 'unsupported') {
      localStorage.setItem(DISMISS_KEY, 'true');
      setMode(null);
    } else {
      setStatus('error'); // let them retry
    }
  };

  if (!mode) return null;

  if (mode === 'denied') {
    return (
      <div className="push-banner" role="status">
        <div className="push-banner-icon">
          <Bell size={18} />
        </div>
        <div className="push-banner-text">
          <strong>Notifications are blocked</strong>
          <span>
            You won't get alerts for {role === 'tutor' ? 'new uploads or tickets' : 'certificate or ticket updates'} until
            you re-enable notifications for this site in your browser's settings.
          </span>
        </div>
        <div className="push-banner-actions">
          <button type="button" className="push-banner-dismiss" onClick={dismiss} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="push-banner" role="status">
      <div className="push-banner-icon">
        <Bell size={18} />
      </div>
      <div className="push-banner-text">
        <strong>Turn on notifications</strong>
        <span>
          {role === 'tutor'
            ? "Get notified the moment a student uploads a certificate or raises a ticket."
            : "Get notified when your certificate is approved/rejected or your ticket is updated."}
        </span>
        {status === 'error' && <span className="push-banner-error">Something went wrong — try again.</span>}
      </div>
      <div className="push-banner-actions">
        <button type="button" className="push-banner-enable" onClick={enable} disabled={status === 'asking'}>
          {status === 'asking' ? 'Enabling…' : 'Enable'}
        </button>
        <button type="button" className="push-banner-dismiss" onClick={dismiss} aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
