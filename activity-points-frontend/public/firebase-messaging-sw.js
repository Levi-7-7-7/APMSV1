/**
 * public/firebase-messaging-sw.js
 *
 * Dedicated service worker for Firebase Cloud Messaging web push, and
 * the app's only service worker — Firebase docs recommend a standalone
 * file for this rather than folding it into a general-purpose one.
 * Registered early at app startup (see main.jsx) so the app is
 * installable on Android/Chrome regardless of whether the user has
 * opted into push notifications yet.
 *
 * This file is served as-is from /public (Vite does NOT process it), so
 * it can't read import.meta.env. Instead, the app registers it with the
 * Firebase config passed as a query string:
 *
 *   navigator.serviceWorker.register(
 *     `/firebase-messaging-sw.js?${new URLSearchParams(firebaseConfig)}`
 *   )
 *
 * — see src/utils/pushNotifications.js. The config values (apiKey,
 * projectId, etc.) are all public/client-side identifiers, not secrets,
 * so passing them this way is safe.
 */
importScripts('https://www.gstatic.com/firebasejs/11.4.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.4.0/firebase-messaging-compat.js');

const params = new URLSearchParams(self.location.search);

firebase.initializeApp({
  apiKey:            params.get('apiKey'),
  authDomain:        params.get('authDomain'),
  projectId:         params.get('projectId'),
  storageBucket:     params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId:             params.get('appId'),
});

const messaging = firebase.messaging();

// Without these, an updated service-worker file installs but sits
// "waiting" — the OLD version stays in control of any tab that was
// already open when the update shipped, and only the new version takes
// over once every tab of the app is fully closed and reopened. That's
// what caused notification clicks to behave inconsistently right after a
// deploy (some tabs on the new click-handling logic, others silently
// still running the old one) even though there's only ever one SW file.
// skipWaiting() + clients.claim() make every update take effect for all
// open tabs the moment it installs, no full close-and-reopen required.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Fires when a push arrives while no tab has focus (or the app is closed
// entirely, on platforms that support it). Foreground messages — the app
// open and focused — are handled instead in src/utils/pushNotifications.js
// via onMessage(), since a background handler doesn't run for those.
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  // The backend now sends data-only messages for web (see utils/fcm.js on
  // the server) precisely so this handler is the ONLY thing that ever
  // displays a notification — title/body live in `data`, not
  // `payload.notification`, which is intentionally left empty to stop the
  // browser auto-displaying its own duplicate notification.
  const title = payload.notification?.title || data.title || 'Activity Points';
  const body = payload.notification?.body || data.body || '';

  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    tag: data.certId || data.ticketId || undefined, // collapse repeat notifs for the same item
    data,
  });
});

// Clicking the notification focuses an existing tab if one is open,
// otherwise opens a new one — both landing on the relevant page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification?.data?.link || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Reuse any already-open tab of the app, rather than requiring it to
      // already be sitting on `link` — the previous version only focused an
      // existing tab if its *current* URL happened to already contain the
      // target link, which almost never held (e.g. sitting on /student
      // when a ticket notification for /student/tickets arrives). That
      // mismatch meant it fell through to clients.openWindow() nearly
      // every time, which looked like the app relaunching even though it
      // was already open in front of you. Now we just navigate whichever
      // tab we find to the right page and focus it.
      const existing = windowClients.find((c) => 'focus' in c);
      if (existing) {
        const goTo = existing.navigate ? existing.navigate(link).catch(() => existing) : Promise.resolve(existing);
        return goTo.then((client) => (client || existing).focus());
      }
      if (clients.openWindow) return clients.openWindow(link);
    })
  );
});
