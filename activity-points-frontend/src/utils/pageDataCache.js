// Module-scoped Map for the fast path (survives a page component being
// unmounted and remounted, which happens on every swipe/tab change since
// each screen is a fresh `motion.div` keyed by route) — PLUS a
// localStorage-backed layer so the data also survives a real page
// reload, i.e. the app being fully closed and reopened.
//
// Why both: the in-memory Map is instant and needs no serialization, so
// it's what every getCached()/setCached() call uses during a normal
// session. localStorage is only consulted as a fallback on first read
// (a cold start), then promoted into the Map so the rest of the session
// stays fast. This is what lets a page show its last known data
// immediately — before any network request resolves, or even if the
// device is offline and no request will ever resolve.
//
// A page reload while online still triggers each page's own fetch
// afterward and overwrites this with fresh data, exactly as before —
// this only changes what's shown *before* that fetch settles.

const cache = new Map();
const STORAGE_PREFIX = 'apms:pageCache:';

function readFromStorage(key) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch (_) {
    return undefined;
  }
}

function writeToStorage(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (_) {
    // Storage full/unavailable (e.g. private browsing) — the in-memory
    // cache still works for the rest of this session, just not across a
    // full reload. Not worth surfacing to the user.
  }
}

export function getCached(key) {
  if (cache.has(key)) return cache.get(key);

  const stored = readFromStorage(key);
  if (stored !== undefined) cache.set(key, stored); // promote for fast subsequent reads
  return stored;
}

export function setCached(key, value) {
  cache.set(key, value);
  writeToStorage(key, value);
}

export function clearCached(key) {
  if (key) {
    cache.delete(key);
    try { localStorage.removeItem(STORAGE_PREFIX + key); } catch (_) {}
  } else {
    cache.clear();
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(STORAGE_PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    } catch (_) {}
  }
}

/**
 * Wipes every page's cached data — both this in-memory/localStorage
 * layer AND the service worker's cached API responses (see
 * public/firebase-messaging-sw.js) — and should be called on logout.
 *
 * Without this, a shared/family device could show one account's cached
 * dashboard, certificates, etc. briefly (or, while offline, indefinitely)
 * right after a *different* account logs in on the same browser, since
 * both the localStorage cache and the SW's API cache are keyed by URL,
 * not by which user was signed in when the data was fetched.
 */
export function clearAllOfflineCaches() {
  clearCached();
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_API_CACHE' });
  } catch (_) {}
}
