/**
 * src/utils/firebase.js
 *
 * Firebase Web App client — used only for Cloud Messaging (web push).
 * Nothing else in the app touches Firebase, so this file stays tiny.
 *
 * Config comes from Vite env vars (see .env.example) so dev/staging/prod
 * can point at different Firebase projects without code changes.
 */
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, isSupported } from 'firebase/messaging';

export const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Only initialise if the env vars are actually filled in — lets the app
// still run locally (minus push notifications) before Firebase is set up.
const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.appId);

export const firebaseApp = isConfigured && getApps().length === 0
  ? initializeApp(firebaseConfig)
  : (getApps()[0] || null);

/**
 * Lazily resolves a Messaging instance, or null if push isn't usable here
 * (unsupported browser, Firebase not configured, not served over HTTPS, …).
 * Always await this — isSupported() does an async feature check.
 */
export async function getMessagingInstance() {
  if (!firebaseApp) return null;
  try {
    const supported = await isSupported();
    if (!supported) return null;
    return getMessaging(firebaseApp);
  } catch {
    return null;
  }
}
