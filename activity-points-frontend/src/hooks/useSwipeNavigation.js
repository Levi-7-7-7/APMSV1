import { useRef, useState, useCallback } from 'react';

/**
 * Walks up from `start` (the raw touch target) toward `boundary` (the
 * element the swipe handlers are bound to) looking for an element that
 * scrolls horizontally on its own — e.g. a `.sl-table-wrap` with
 * `overflow-x: auto` around a wide table. Returns that element, or null
 * if the touch didn't start inside one.
 *
 * This is what lets a table too wide for the screen (like the tutor's
 * student list, which hides some columns but still needs a scroll to
 * reach "Points" on narrow phones) be scrolled by hand without every
 * such drag being immediately stolen as a tab-swipe.
 */
function findHorizontalScrollAncestor(start, boundary) {
  let node = start;
  while (node && node !== boundary) {
    if (node.nodeType === 1) {
      const style = window.getComputedStyle(node);
      if (
        (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
        node.scrollWidth > node.clientWidth + 1
      ) {
        return node;
      }
    }
    node = node.parentNode;
  }
  return null;
}

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
  // The horizontally-scrollable element (if any) the touch started
  // inside of — e.g. a wide table's scroll wrapper. Re-detected fresh
  // on every touchstart since the DOM under the finger can differ tab
  // to tab.
  const scrollAncestor = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const currentIndex = paths.indexOf(current);

  const reset = useCallback(() => {
    tracking.current = false;
    decided.current = false;
    scrollAncestor.current = null;
    setDragX(0);
    setIsDragging(false);
  }, []);

  const onTouchStart = useCallback((e) => {
    if (currentIndex === -1 || e.touches.length !== 1) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    tracking.current = true;
    decided.current = false;
    scrollAncestor.current = findHorizontalScrollAncestor(e.target, e.currentTarget);
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

      // Horizontal drag — but if it started inside something like the
      // student table's scroll wrapper AND that element still has room
      // to scroll further in this direction, this is the user trying to
      // see a hidden column (e.g. Points), not switch tabs. Bail out and
      // let the browser's native horizontal scroll handle it; we'll get
      // a fresh touchstart (and a fresh chance to decide) next gesture,
      // e.g. once the table is scrolled all the way to an edge.
      const scroller = scrollAncestor.current;
      if (scroller) {
        const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
        const roomToScroll =
          dx < 0
            ? scroller.scrollLeft < maxScrollLeft - 1 // dragging left → more content to the right?
            : scroller.scrollLeft > 1; // dragging right → more content to the left?
        if (roomToScroll) {
          tracking.current = false;
          return;
        }
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
