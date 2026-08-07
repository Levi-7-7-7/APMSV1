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
import { getToken, deleteToken, onMessage } from 'firebase/messaging';
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

    // Firebase's Messaging SDK caches the last token it minted for this
    // origin + SW scope in its own IndexedDB store, independent of
    // localStorage/OS permission. On Android, uninstalling and
    // reinstalling the PWA resets the OS-level permission but does NOT
    // reliably clear that cache — so a plain getToken() call here can
    // hand back a stale token/subscription from a previous install that
    // nothing will ever be delivered to. Explicitly deleting any cached
    // token first forces Firebase to mint a genuinely fresh one bound to
    // the current install, every time a user goes through this flow.
    try {
      await deleteToken(messaging);
    } catch (err) {
      // No cached token to delete, or deletion failed — not fatal, we
      // still attempt to mint a fresh one below.
      console.warn('[push] deleteToken before re-register failed:', err.message);
    }

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

/**
 * Displays a notification for a foreground (tab open + focused) push.
 *
 * IMPORTANT: this must NOT use `new Notification(...)`. Once a service
 * worker is registered — which it always is here, at app startup, for
 * installability — most browsers (notably Chrome on Android) throw
 * "Failed to construct 'Notification': Illegal constructor" on that
 * constructor. The throw happens inside the onMessage callback and isn't
 * caught anywhere upstream, so it fails completely silently: no
 * notification shown, no visible error, nothing in the UI to explain why.
 * That's the exact bug this function fixes — it's why notifications only
 * ever seemed to work while the app was closed.
 *
 * Instead we go through the same service-worker registration the
 * background handler already (correctly) uses, via
 * ServiceWorkerRegistration.showNotification(). Click handling can't be
 * attached directly to the returned object the way `new Notification()`
 * allows (showNotification() returns a Promise<void>, not a Notification
 * instance) — so `data.link` is passed through in the notification's
 * `data` field, and firebase-messaging-sw.js's existing
 * `notificationclick` listener (which already handles background-push
 * clicks the same way) takes care of focusing/opening the right page.
 *
 * @param {string} title
 * @param {string} body
 * @param {object} [data] - arbitrary payload, e.g. { link, certId, ticketId }
 */
export async function showForegroundNotification(title, body, data = {}) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // This app registers exactly one service worker (see SW_URL above), so
    // `.ready` — not getRegistration(SW_URL) — is the right lookup: scope
    // matching ignores the query string, and `.ready` is guaranteed to
    // resolve to *the* active registration once one exists, same as
    // registerPushNotifications()/syncPushToken() already rely on above.
    const registration = await navigator.serviceWorker.ready.catch(() => null);
    if (!registration) return; // no SW yet — nothing safe to show through

    await registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      tag: data.certId || data.ticketId || undefined, // collapse repeat notifs for the same item
      data,
    });
  } catch (err) {
    console.warn('[push] showForegroundNotification failed:', err.message);
  }
}

/** Has the user already granted or explicitly denied notification permission? */
export function getPermissionState() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}
