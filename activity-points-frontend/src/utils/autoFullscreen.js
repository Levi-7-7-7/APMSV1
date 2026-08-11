/**
 * utils/autoFullscreen.js
 *
 * Browsers refuse to auto-enter fullscreen on page load (Element.
 * requestFullscreen() only works inside a real user-gesture handler, e.g.
 * click/keydown) — that's a deliberate anti-annoyance restriction and
 * can't be bypassed. The closest practical equivalent to "opens in
 * fullscreen" is: fullscreen on the very first click/tap after the page
 * loads, so it happens almost immediately without a visible prompt.
 *
 * PC-only by design (see deviceDetect.isDesktopDevice): phones/tablets
 * already run this app as an installed PWA / native app with their own
 * fullscreen-equivalent chrome, and grabbing fullscreen on a touch device
 * from a stray tap would be surprising rather than helpful.
 */
import { isDesktopDevice } from './deviceDetect';

export function initAutoFullscreenOnFirstClick() {
  if (typeof document === 'undefined') return;
  if (!isDesktopDevice()) return;
  if (!document.fullscreenEnabled) return; // e.g. embedded in an iframe that disallows it

  const enterFullscreen = () => {
    document.removeEventListener('click', enterFullscreen);
    document.removeEventListener('keydown', enterFullscreen);

    // Already fullscreen (e.g. user pressed F11 themselves) — nothing to do.
    if (document.fullscreenElement) return;

    document.documentElement.requestFullscreen?.().catch(() => {
      // Some browsers/policies can still refuse (e.g. permissions-policy
      // in an embedding iframe). Fail silently — the app works fine
      // without fullscreen, this is purely a nicety.
    });
  };

  document.addEventListener('click', enterFullscreen, { once: true });
  document.addEventListener('keydown', enterFullscreen, { once: true });
}
