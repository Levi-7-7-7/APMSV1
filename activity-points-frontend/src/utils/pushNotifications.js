/**
 * src/utils/pushNotifications.js
 *
 * Web push registration for students and tutors. Mirrors what the native
 * app already does (register an FCM token with the backend) — the only
 * new pieces are getting a *web* token via Firebase JS SDK, and handling
 * notifications that arrive while the tab is focused (the service worker
 * only fires for background/closed-tab pushes).
 *
 * Usage (see components/NotificationPermissionBanner.jsx):
 *   const result = await registerPushNotifications('student');
 *   // result: 'enabled' | 'unsupported' | 'denied' | 'error'
 */
import { getToken, onMessage } from 'firebase/messaging';
import { getMessagingInstance, firebaseConfig, VAPID_KEY } from './firebase';
import axiosInstance from '../api/axiosInstance';
import tutorAxios from '../api/tutorAxios';

export const SW_URL = `/firebase-messaging-sw.js?${new URLSearchParams(firebaseConfig).toString()}`;

function clientFor(role) {
  return role === 'tutor'
    ? { axios: tutorAxios, endpoint: '/tutors/fcm-token' }
    : { axios: axiosInstance, endpoint: '/students/fcm-token' };
}

/**
 * True if this browser/context can plausibly support web push at all —
 * cheap synchronous checks only (no permission prompt, no SW registration).
 * Notably false on iOS Safari unless the site has been added to the home
 * screen (installed as a PWA) — regular Safari tabs can't get push at all.
 */
export function isPushCapable() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'Notification' in window &&
    !!firebaseConfig.apiKey &&
    !!VAPID_KEY
  );
}

/**
 * Registers the service worker at app startup, with no permission
 * prompt and no user gesture required. This is what makes the app
 * installable on Android/Chrome (Chrome requires a registered SW
 * before it will offer the "Install app" prompt) — previously the SW
 * was only registered inside registerPushNotifications(), which meant
 * a user who hadn't opted into notifications yet couldn't install the
 * app either. Safe to call unconditionally: registering the same
 * scriptURL twice is a no-op that resolves to the existing
 * registration, so this doesn't conflict with the later
 * navigator.serviceWorker.register(SW_URL) call in
 * registerPushNotifications().
 *
 * Call once, near app root (see main.jsx). Fails silently — push/
 * installability just won't be available, nothing else breaks.
 */
export async function registerServiceWorkerForInstallability() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (!firebaseConfig.apiKey) return; // Firebase not configured yet

  try {
    await navigator.serviceWorker.register(SW_URL);
  } catch (err) {
    console.warn('[push] service worker registration failed:', err.message);
  }
}

/**
 * Full opt-in flow: register the dedicated service worker, ask for
 * notification permission, get a web FCM token, and send it to the
 * backend to store on this student/tutor's account.
 *
 * Must be called from a user gesture (button click) — browsers block
 * permission prompts triggered any other way.
 *
 * @param {'student'|'tutor'} role
 * @returns {Promise<'enabled'|'unsupported'|'denied'|'error'>}
 */
export async function registerPushNotifications(role) {
  if (!isPushCapable()) return 'unsupported';

  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return 'unsupported';

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    const registration = await navigator.serviceWorker.register(SW_URL);
    // Make sure it's actually active before asking Firebase to use it.
    await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return 'error';

    const { axios, endpoint } = clientFor(role);
    await axios.patch(endpoint, { fcmToken: token, platform: 'web' });

    return 'enabled';
  } catch (err) {
    console.warn('[push] registration failed:', err.message);
    return 'error';
  }
}

/**
 * Silent re-sync: if the browser has ALREADY granted notification
 * permission, (re)mint a web FCM token and PATCH it to the backend —
 * with no permission prompt, so it's safe to call on every app/login
 * mount rather than only from a button click.
 *
 * Why this is needed in addition to the banner:
 *   - The banner only renders while permission is still 'default'. Once
 *     a user has granted permission in this browser, the banner never
 *     shows again — so if the *server-side* token is ever missing
 *     (account has no fcmToken yet, a previous token was pruned as
 *     dead, or a different account logs in on the same shared browser/
 *     device where permission was already granted for a prior account)
 *     there was previously no path back to a registered token.
 *   - FCM tokens can also rotate; calling getToken() again is the
 *     documented way to keep the current one fresh, and it returns the
 *     existing token unchanged if nothing has changed.
 *
 * Call this once near the top of each authenticated layout (student/
 * tutor) so every login — not just the very first one — ends with a
 * valid token on file for that account.
 *
 * @param {'student'|'tutor'} role
 * @returns {Promise<'synced'|'skipped'|'error'>}
 */
export async function syncPushToken(role) {
  if (!isPushCapable()) return 'skipped';
  if (getPermissionState() !== 'granted') return 'skipped'; // don't prompt here

  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return 'skipped';

    const registration = await navigator.serviceWorker.register(SW_URL);
    await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return 'error';

    const { axios, endpoint } = clientFor(role);
    await axios.patch(endpoint, { fcmToken: token, platform: 'web' });

    return 'synced';
  } catch (err) {
    console.warn('[push] silent token sync failed:', err.message);
    return 'error';
  }
}

/**
 * Listens for notifications that arrive while the tab is open and
 * focused (the service worker's onBackgroundMessage doesn't fire for
 * these). Call once near app root; returns an unsubscribe function.
 *
 * @param {(payload: { title: string, body: string, data: object }) => void} onNotification
 */
export function listenForForegroundMessages(onNotification) {
  let unsubscribe = () => {};

  (async () => {
    const messaging = await getMessagingInstance();
    if (!messaging) return;

    unsubscribe = onMessage(messaging, (payload) => {
      const data = payload.data || {};
      onNotification({
        title: payload.notification?.title || data.title || 'Activity Points',
        body: payload.notification?.body || data.body || '',
        data,
      });
    });
  })();

  return () => unsubscribe();
}

/** Has the user already granted or explicitly denied notification permission? */
export function getPermissionState() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}
