import { useRef, useState, useCallback } from 'react';

/**
 * Swipe-between-tabs gesture, like a native app's horizontal ViewPager.
 *
 * @param {string[]} paths   Ordered list of routes, matching bottom-nav order.
 * @param {string}   current Current pathname (from useLocation().pathname).
 * @param {(path: string) => void} onNavigate  Called with the target path.
 *
 * Returns touch handlers to spread onto the swipeable container, plus a
 * `dragX` value (px, signed) for optional live drag feedback while the
 * finger is down — 0 when idle.
 */
export default function useSwipeNavigation(paths, current, onNavigate) {
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);
  const decided = useRef(false); // once true, gesture is committed as horizontal or vertical
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const currentIndex = paths.indexOf(current);

  const reset = useCallback(() => {
    tracking.current = false;
    decided.current = false;
    setDragX(0);
    setIsDragging(false);
  }, []);

  const onTouchStart = useCallback((e) => {
    if (currentIndex === -1 || e.touches.length !== 1) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    tracking.current = true;
    decided.current = false;
  }, [currentIndex]);

  const onTouchMove = useCallback((e) => {
    if (!tracking.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (!decided.current) {
      // Wait until the gesture is clearly horizontal or vertical before
      // committing, so normal vertical page scrolling isn't hijacked.
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) <= Math.abs(dy)) {
        tracking.current = false; // vertical scroll — let the browser handle it
        return;
      }
      decided.current = true;
      setIsDragging(true);
    }

    // Don't allow dragging past the first/last tab.
    const atStart = currentIndex === 0 && dx > 0;
    const atEnd = currentIndex === paths.length - 1 && dx < 0;
    setDragX(atStart || atEnd ? dx / 3 : dx); // slight resistance at the edges
  }, [currentIndex, paths.length]);

  const onTouchEnd = useCallback((e) => {
    if (!tracking.current || !decided.current) {
      reset();
      return;
    }
    const dx = e.changedTouches[0].clientX - startX.current;
    const SWIPE_THRESHOLD = 60; // px

    if (dx <= -SWIPE_THRESHOLD && currentIndex < paths.length - 1) {
      onNavigate(paths[currentIndex + 1]);
    } else if (dx >= SWIPE_THRESHOLD && currentIndex > 0) {
      onNavigate(paths[currentIndex - 1]);
    }
    reset();
  }, [currentIndex, paths, onNavigate, reset]);

  return {
    dragX,
    isDragging,
    currentIndex,
    swipeHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: reset,
    },
  };
}
