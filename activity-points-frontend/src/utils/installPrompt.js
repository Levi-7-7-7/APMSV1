/**
 * src/utils/installPrompt.js
 *
 * Captures the browser's `beforeinstallprompt` event so the app can show
 * its own "Install App" button instead of relying purely on the browser's
 * native install UI (which only appears after the browser's own, opaque
 * engagement heuristics are met — not on a first visit).
 *
 * IMPORTANT: `beforeinstallprompt` only fires at all once the manifest +
 * service worker installability criteria are met (valid manifest, icons
 * that match their declared sizes, a registered service worker, HTTPS).
 * This module doesn't change those criteria — see manifest.json and
 * registerServiceWorkerForInstallability() in pushNotifications.js — it
 * just gives the app a hook into the moment the browser decides the app
 * IS installable.
 *
 * Also unsupported on iOS Safari — that platform never fires
 * beforeinstallprompt; "Add to Home Screen" there is a manual step from
 * the Safari share sheet, which no JS API can trigger.
 *
 * Usage:
 *   import { onInstallAvailabilityChange, promptInstall, isAppInstalled } from './installPrompt';
 *   const unsubscribe = onInstallAvailabilityChange((available) => setVisible(available));
 *   // later, from a button click:
 *   const outcome = await promptInstall(); // 'accepted' | 'dismissed' | 'unavailable'
 */

let deferredPrompt = null;
let installed = false;
const listeners = new Set();

function notify() {
  const available = !!deferredPrompt && !installed;
  listeners.forEach((cb) => cb(available));
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Stop Chrome's default mini-infobar so we control the UI instead.
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    notify();
  });
}

/** True if the browser has signalled the app is installable right now. */
export function isInstallAvailable() {
  return !!deferredPrompt && !installed;
}

/**
 * Subscribe to changes in install availability. Calls `cb(available)`
 * immediately with the current state, then again whenever it changes.
 * Returns an unsubscribe function.
 */
export function onInstallAvailabilityChange(cb) {
  listeners.add(cb);
  cb(isInstallAvailable());
  return () => listeners.delete(cb);
}

/**
 * Shows the browser's native install confirmation using the captured
 * event. Must be called from a user gesture (button click).
 *
 * @returns {Promise<'accepted'|'dismissed'|'unavailable'>}
 */
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';

  const promptEvent = deferredPrompt;
  // A captured prompt event can only be used once.
  deferredPrompt = null;
  notify();

  promptEvent.prompt();
  const { outcome } = await promptEvent.userChoice; // 'accepted' | 'dismissed'
  return outcome;
}
