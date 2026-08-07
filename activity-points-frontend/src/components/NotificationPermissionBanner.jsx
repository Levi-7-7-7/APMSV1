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

// Both keys store the *permission value that was active when the user
// dismissed*, not a plain boolean. A dismissal only suppresses the banner
// for that specific permission state — if permission later changes (user
// re-enables in OS settings, then later disables again; or the reverse),
// the stored value no longer matches getPermissionState() and the banner
// reappears instead of staying suppressed forever. A plain 'true' flag
// broke exactly this way: once dismissed one time, localStorage persists
// across reinstalls and OS-level toggles, so the banner would never
// re-render even after permission genuinely changed again.
const DISMISS_KEY = 'pushPromptDismissed';
const BLOCKED_DISMISS_KEY = 'pushBlockedNoticeDismissed';

export default function NotificationPermissionBanner({ role }) {
  // 'default' → show the opt-in nudge; 'denied' → show the blocked notice;
  // null → capable/dismissed-for-this-state/granted, render nothing.
  const [mode, setMode] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | asking | error

  useEffect(() => {
    const capable = isPushCapable();
    if (!capable) return;

    const permission = getPermissionState();

    if (permission === 'default' && localStorage.getItem(DISMISS_KEY) !== 'default') {
      setMode('default');
    } else if (permission === 'denied' && localStorage.getItem(BLOCKED_DISMISS_KEY) !== 'denied') {
      setMode('denied');
    }
  }, []);

  const dismiss = () => {
    const permission = getPermissionState();
    localStorage.setItem(mode === 'denied' ? BLOCKED_DISMISS_KEY : DISMISS_KEY, permission);
    setMode(null);
  };

  const enable = async () => {
    setStatus('asking');
    const result = await registerPushNotifications(role);

    if (result === 'enabled') {
      // Don't touch DISMISS_KEY here. It's meant to mean "the user
      // explicitly closed the banner with the X" — setting it on the
      // success path too is both unnecessary (permission being
      // 'granted' already keeps the banner from rendering, see the
      // mount check below) and actively harmful: on Android, uninstalling
      // the PWA resets permission back to 'default' but does NOT clear
      // localStorage, so a stale DISMISS_KEY='true' from a previous
      // successful enable would permanently suppress the banner on
      // reinstall even though the user now has zero notification setup.
      setMode(null);
    } else if (result === 'denied') {
      // The user just blocked it in the native dialog — switch straight
      // to the blocked-state message instead of vanishing. This uses
      // BLOCKED_DISMISS_KEY's mode, not DISMISS_KEY, so it's likewise
      // left untouched here.
      setStatus('idle');
      setMode('denied');
    } else if (result === 'unsupported') {
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
