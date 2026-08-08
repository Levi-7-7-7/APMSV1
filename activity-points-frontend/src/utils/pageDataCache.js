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
// Keys that have been through a REAL setCached() write during this JS
// execution context — i.e. actually fetched (or otherwise produced) this
// session, as opposed to merely sitting in `cache` because getCached()
// promoted an old localStorage snapshot there. Deliberately separate
// from `cache` itself — see isSessionCached() below for why that
// distinction matters.
const sessionFetchedKeys = new Set();
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
  // Promoted into `cache` for fast subsequent reads, but this is NOT a
  // real fetch — it's a passive read of whatever was last saved, possibly
  // from a previous session — so it must NOT mark `key` as session-fetched.
  // Most pages call getCached() once at the top of the component to seed
  // initial state, on every mount including a cold start; if that alone
  // counted as "session cached", isSessionCached() below would be
  // useless — it would already read true before the effect that's
  // supposed to consult it ever runs.
  if (stored !== undefined) cache.set(key, stored);
  return stored;
}

/**
 * True only if `key` has been written by a real setCached() call at some
 * point during THIS JS execution context — i.e. this page has actually
 * fetched (or been given fresh) data this session. False on a cold start
 * (a real page load — full reload, new tab, or a notification click
 * opening the app fresh), even though the component's initial
 * `getCached(key)` read (for instant paint from a prior session's
 * localStorage snapshot) has by then already populated `cache` — because
 * that promotion alone never touches sessionFetchedKeys.
 *
 * Why this matters: pages use `existing && !isRefresh` to skip
 * re-fetching on a plain in-app remount (e.g. swiping back to a tab).
 * Without this check, that same skip also fired on a genuine cold
 * start — since `refreshToken` starts out equal to its own initial ref
 * value there too, and the top-of-component getCached() call already
 * makes `existing` truthy — silently showing a stale localStorage
 * snapshot with no fetch ever kicked off. That's what made a fresh app
 * launch from a notification click land on the right *page* but the
 * wrong *data* (e.g. a just-approved certificate missing from the list)
 * until the user hit the manual refresh button. Gating the skip on
 * isSessionCached() as well means a cold start always fetches fresh,
 * while a same-session remount (where the earlier fetch already called
 * setCached()) still reuses the cache instantly.
 */
export function isSessionCached(key) {
  return sessionFetchedKeys.has(key);
}

export function setCached(key, value) {
  cache.set(key, value);
  sessionFetchedKeys.add(key);
  writeToStorage(key, value);
}

export function clearCached(key) {
  if (key) {
    cache.delete(key);
    sessionFetchedKeys.delete(key);
    try { localStorage.removeItem(STORAGE_PREFIX + key); } catch (_) {}
  } else {
    cache.clear();
    sessionFetchedKeys.clear();
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
