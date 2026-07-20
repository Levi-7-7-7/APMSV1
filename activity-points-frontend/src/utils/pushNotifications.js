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

const SW_URL = `/firebase-messaging-sw.js?${new URLSearchParams(firebaseConfig).toString()}`;

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
      onNotification({
        title: payload.notification?.title || 'Activity Points',
        body: payload.notification?.body || '',
        data: payload.data || {},
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
