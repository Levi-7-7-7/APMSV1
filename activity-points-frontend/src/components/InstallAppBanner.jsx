/**
 * InstallAppBanner — small dismissible strip offering to install APMS as
 * an app. Only renders when the browser has actually fired
 * `beforeinstallprompt` (see utils/installPrompt.js), i.e. when the
 * manifest + service worker installability criteria are met AND the
 * browser is willing to offer install right now.
 *
 * Installing MUST happen from a user gesture, hence the button rather
 * than an automatic prompt on mount.
 *
 * Usage:
 *   <InstallAppBanner />
 */
import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { onInstallAvailabilityChange, promptInstall } from '../utils/installPrompt';
import '../css/NotificationPermissionBanner.css';

const DISMISS_KEY = 'installPromptDismissed';

export default function InstallAppBanner() {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === 'true');
  const [status, setStatus] = useState('idle'); // idle | asking

  useEffect(() => onInstallAvailabilityChange(setAvailable), []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  const install = async () => {
    setStatus('asking');
    const outcome = await promptInstall();

    // Either way, the browser won't offer this same prompt again until
    // the user revisits later — no point showing our banner meanwhile.
    if (outcome === 'accepted' || outcome === 'dismissed') {
      localStorage.setItem(DISMISS_KEY, 'true');
      setDismissed(true);
    } else {
      setStatus('idle');
    }
  };

  if (!available || dismissed) return null;

  return (
    <div className="push-banner" role="status">
      <div className="push-banner-icon">
        <Download size={18} />
      </div>
      <div className="push-banner-text">
        <strong>Install APMS</strong>
        <span>Add it to your home screen for quicker, full-screen access.</span>
      </div>
      <div className="push-banner-actions">
        <button type="button" className="push-banner-enable" onClick={install} disabled={status === 'asking'}>
          {status === 'asking' ? 'Installing…' : 'Install'}
        </button>
        <button type="button" className="push-banner-dismiss" onClick={dismiss} aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
