/**
 * utils/deviceDetect.js
 *
 * One shared heuristic for "is this a PC?" so every feature that should be
 * desktop-only (auto-fullscreen, desktop PWA manifest, etc.) agrees on the
 * same answer.
 *
 * A device counts as a PC when:
 *   - its primary pointer is fine (mouse/trackpad), not coarse (touch), AND
 *   - the user agent doesn't identify as a phone/tablet OS.
 *
 * Both checks are used together because either one alone is unreliable:
 * some touch laptops report a coarse pointer, and some tablets (iPad with
 * "desktop site" mode) spoof a desktop-looking UA. Excluding either signal
 * on its own avoids most false positives in both directions.
 */
export function isDesktopDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const hasFinePointer =
    window.matchMedia?.('(pointer: fine)').matches ?? true;

  const isMobileUA = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(
    navigator.userAgent || ''
  );

  return hasFinePointer && !isMobileUA;
}
