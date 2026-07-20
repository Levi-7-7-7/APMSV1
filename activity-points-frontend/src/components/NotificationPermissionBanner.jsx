/**
 * NotificationPermissionBanner — small dismissible strip nudging the
 * student/tutor to turn on push notifications (new certificate uploaded,
 * approved/rejected, ticket updates). Only renders when:
 *   - the browser can plausibly support web push (isPushCapable), AND
 *   - permission hasn't been granted or denied yet, AND
 *   - the user hasn't dismissed it before on this device.
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

export default function NotificationPermissionBanner({ role }) {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | asking | error

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY) === 'true';
    const capable = isPushCapable();
    const permission = getPermissionState();
    setVisible(capable && !dismissed && permission === 'default');
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setVisible(false);
  };

  const enable = async () => {
    setStatus('asking');
    const result = await registerPushNotifications(role);

    if (result === 'enabled') {
      localStorage.setItem(DISMISS_KEY, 'true');
      setVisible(false);
    } else if (result === 'denied' || result === 'unsupported') {
      // Browser will remember the denial itself — no point asking again.
      localStorage.setItem(DISMISS_KEY, 'true');
      setVisible(false);
    } else {
      setStatus('error'); // let them retry
    }
  };

  if (!visible) return null;

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
