/**
 * public/firebase-messaging-sw.js
 *
 * Dedicated service worker for Firebase Cloud Messaging web push. Kept
 * separate from the app's main service worker (sw.js) — Firebase docs
 * recommend a standalone file, and it avoids any interference with
 * whatever caching/PWA logic sw.js does.
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

// Fires when a push arrives while no tab has focus (or the app is closed
// entirely, on platforms that support it). Foreground messages — the app
// open and focused — are handled instead in src/utils/pushNotifications.js
// via onMessage(), since a background handler doesn't run for those.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Activity Points';
  const body = payload.notification?.body || '';
  const data = payload.data || {};

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
      for (const client of windowClients) {
        if (client.url.includes(link) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(link);
    })
  );
});
