// Module-scoped (not React state), so it survives a page component being
// unmounted and remounted — which now happens on every swipe/tab change
// since each screen is a fresh `motion.div` keyed by route. A real page
// reload still clears it, which is fine: a fresh load should fetch fresh
// data anyway. Only an explicit refresh (see StudentLayout's refresh
// button) forces a page to bypass this and re-fetch.
const cache = new Map();

export function getCached(key) {
  return cache.has(key) ? cache.get(key) : undefined;
}

export function setCached(key, value) {
  cache.set(key, value);
}

export function clearCached(key) {
  if (key) cache.delete(key);
  else cache.clear();
}
