/**
 * public/firebase-messaging-sw.js
 *
 * The app's ONLY service worker — registered unconditionally at startup
 * (see src/utils/pushNotifications.js). It now does two independent jobs:
 *
 *   1. Offline caching — lets the app open (and show last-known data)
 *      even when it was fully closed and the device has no connection.
 *      Previously nothing filled this role: this file had no `fetch`
 *      handler, and the one file that did (public/sw.js) was never
 *      registered anywhere, so a cold offline launch fell through to the
 *      browser's own native "no internet" page.
 *
 *   2. Firebase Cloud Messaging (web push) — background notifications
 *      and notification-click handling. Unchanged from before, except it
 *      now only runs if Firebase config was actually passed in, so a
 *      deployment without push configured doesn't lose offline support.
 *
 * Config for #2 arrives as a query string on the registration URL (this
 * file is served as-is from /public, so it can't read import.meta.env):
 *
 *   navigator.serviceWorker.register(
 *     `/firebase-messaging-sw.js?${new URLSearchParams(firebaseConfig)}`
 *   )
 *
 * — see src/utils/pushNotifications.js. The config values (apiKey,
 * projectId, etc.) are all public/client-side identifiers, not secrets,
 * so passing them this way is safe.
 */

// ============================================================
// 1. OFFLINE CACHING
// ============================================================
//
// Three caches:
//   - SHELL_CACHE   the app's own HTML/JS/CSS (lets the app boot at all)
//   - RUNTIME_CACHE other same-origin static assets (icons, manifest, ...)
//   - API_CACHE     GET responses from the backend (dashboard, my
//                    certificates, categories, tickets, ...) so pages
//                    have real data to render instead of staying blank
//
// Strategies:
//   - Navigations (opening/reloading the app): network-first, falling
//     back to the cached shell when there's no connection.
//   - Same-origin static assets: cache-first, refreshed in the
//     background (stale-while-revalidate) so the next online visit
//     stays current.
//   - Backend GET requests: network-first, falling back to the last
//     cached response when offline.
//   - Anything that isn't a GET (creating/updating/deleting data) always
//     goes straight to the network and is never cached — the app already
//     guards those actions behind an online check (see useOnlineStatus).

const VERSION = 'v1';
const SHELL_CACHE = `apms-shell-${VERSION}`;
const RUNTIME_CACHE = `apms-runtime-${VERSION}`;
const API_CACHE = `apms-api-${VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, RUNTIME_CACHE, API_CACHE];
const SHELL_URL = '/';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.add(SHELL_URL).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !CURRENT_CACHES.includes(key)).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// Lets the app tell this worker to forget cached API data — used on
// logout so one student's cached /students/me, certificates, etc. can't
// end up being served to a different account that later logs in on the
// same shared device.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_API_CACHE') {
    event.waitUntil(caches.delete(API_CACHE));
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // writes always go straight to the network

  const url = new URL(request.url);

  // Opening/reloading the app itself.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE, SHELL_URL));
    return;
  }

  if (url.origin === self.location.origin) {
    // Our own JS/CSS bundles, icons, manifest, etc. — but leave this
    // script's own importScripts() dependencies (Firebase CDN, below)
    // to the browser's normal HTTP cache rather than our own.
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  // Cross-origin: the backend API.
  event.respondWith(networkFirst(request, API_CACHE));
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = (await cache.match(request)) || (fallbackUrl && (await cache.match(fallbackUrl)));
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || (await networkFetch) || Response.error();
}

// ============================================================
// 2. FIREBASE CLOUD MESSAGING (web push) — only if configured
// ============================================================
//
// Wrapped in try/catch and gated on an apiKey actually being present:
// a deployment that hasn't set up Firebase yet (see .env.example) must
// not lose the offline caching above just because this part has nothing
// to initialize.
try {
  const params = new URLSearchParams(self.location.search);

  if (params.get('apiKey')) {
    importScripts('https://www.gstatic.com/firebasejs/11.4.0/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/11.4.0/firebase-messaging-compat.js');

    firebase.initializeApp({
      apiKey: params.get('apiKey'),
      authDomain: params.get('authDomain'),
      projectId: params.get('projectId'),
      storageBucket: params.get('storageBucket'),
      messagingSenderId: params.get('messagingSenderId'),
      appId: params.get('appId'),
    });

    const messaging = firebase.messaging();

    // Fires when a push arrives while no tab has focus (or the app is
    // closed entirely, on platforms that support it). Foreground
    // messages — the app open and focused — are handled instead in
    // src/utils/pushNotifications.js via onMessage(), since a background
    // handler doesn't run for those.
    messaging.onBackgroundMessage((payload) => {
      const data = payload.data || {};
      // The backend sends data-only messages for web (see utils/fcm.js
      // on the server) precisely so this handler is the ONLY thing that
      // ever displays a notification — title/body live in `data`, not
      // `payload.notification`, which is intentionally left empty to
      // stop the browser auto-displaying its own duplicate notification.
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
    // otherwise opens a new one — both landing on the relevant page,
    // refreshed with current backend data.
    self.addEventListener('notificationclick', (event) => {
      event.notification.close();
      const link = event.notification?.data?.link || '/';

      event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
          const existing = windowClients.find((c) => 'focus' in c);
          if (existing) {
            // Deliberately NOT using existing.navigate(link) here: when
            // the tab is already sitting on `link` (the common case — the
            // app is open, possibly already on the exact page the
            // notification is about), several browsers treat
            // WindowClient.navigate() to an unchanged URL as a
            // same-document no-op and skip the network fetch entirely —
            // the tab gets focused but nothing actually reloads or
            // re-fetches. Posting a message and letting the PAGE itself
            // do `window.location.href = link` (see main.jsx) always
            // forces a genuine navigation/reload, even to an identical
            // URL, guaranteeing a fresh fetch from the backend every time.
            existing.postMessage({ type: 'NOTIFICATION_NAVIGATE', link });
            return existing.focus();
          }
          // No tab open at all — a brand new window loads fresh by definition.
          if (clients.openWindow) return clients.openWindow(link);
        })
      );
    });
  }
} catch (err) {
  // Never let a Firebase/push setup failure take down the fetch handler
  // above — offline caching must keep working regardless.
  console.warn('[sw] Firebase messaging setup skipped:', err && err.message);
}
