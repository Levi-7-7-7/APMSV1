/**
 * CertModal — inline image / PDF viewer with real download
 * 
 * Usage:
 *   <CertModal url={cert.fileUrl} fileName="certificate.jpg" onClose={() => setOpen(false)} />
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Loader2, ExternalLink, AlertTriangle } from 'lucide-react';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;

// Determine if a URL points to a PDF — check the actual file extension in
// the path (ignoring any query string/hash), not just "does '.pdf' appear
// anywhere in the string". A loose substring check can misfire on ImageKit
// URLs that carry the original event name in the path (e.g. a student
// naming their upload something containing "pdf" while the file itself is
// a JPG), which would wrongly render an <iframe> for an image and leave
// the modal looking blank.
function isPdf(url = '') {
  try {
    const path = new URL(url).pathname;
    return path.toLowerCase().endsWith('.pdf');
  } catch {
    // Not a parseable absolute URL — fall back to a simple check on the
    // part before any query string.
    return (url.split('?')[0] || '').toLowerCase().endsWith('.pdf');
  }
}

// Download the file without opening a new tab
async function triggerDownload(url, fileName) {
  try {
    const res  = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href     = blobUrl;
    a.download = fileName || 'certificate';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    // Fallback: open in new tab
    window.open(url, '_blank');
  }
}

function dist(t1, t2) {
  return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
}

function midpoint(t1, t2) {
  return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
}

export default function CertModal({ url, fileName = 'certificate', onClose }) {
  const pdf = isPdf(url);

  // Tracks whether the preview actually rendered something. Images report
  // this reliably via onLoad/onError. Iframes don't — a blocked/failed
  // PDF load fires neither event in most browsers, so for PDFs we instead
  // start "unconfirmed" and reveal a fallback notice after a short delay,
  // giving the real content a chance to paint first without ever leaving
  // the tutor staring at a truly empty modal with no way out.
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [showPdfFallback, setShowPdfFallback] = useState(false);

  // Pinch-to-zoom / pan state for the image view. The whole app disables
  // native pinch-zoom (see index.html's `user-scalable=no`, needed so
  // normal UI taps don't accidentally zoom the page), so this is a
  // hand-rolled replacement scoped to just this image.
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const bodyRef = useRef(null);
  const imgElRef = useRef(null);
  // Mutable gesture-tracking refs — don't need to trigger re-renders on
  // every touchmove, only the resulting scale/pan state above does.
  const gesture = useRef(null); // { mode: 'pinch' | 'pan', ...startInfo }
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });

  const clampPan = useCallback((x, y, s) => {
    const body = bodyRef.current;
    const img = imgElRef.current;
    if (!body || !img) return { x, y };
    // How much bigger than the viewport the scaled image is, per axis —
    // that's the maximum distance it can be panned before an edge would
    // pull inward past the frame.
    const overflowX = Math.max(0, img.offsetWidth * s - body.clientWidth);
    const overflowY = Math.max(0, img.offsetHeight * s - body.clientHeight);
    const maxX = overflowX / 2;
    const maxY = overflowY / 2;
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    gesture.current = null;
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Reset per-file load state (and any zoom/pan) whenever a different
  // certificate is opened.
  useEffect(() => {
    setImgFailed(false);
    setImgLoaded(false);
    setShowPdfFallback(false);
    resetZoom();
    if (pdf) {
      const t = setTimeout(() => setShowPdfFallback(true), 2500);
      return () => clearTimeout(t);
    }
  }, [url, pdf, resetZoom]);

  // Every handler below both (a) stops the touch gesture from bubbling to
  // the swipeable tab track behind this modal, and (b) drives the actual
  // pinch/pan interaction. (a) matters even for PDFs/loading/error states
  // that don't zoom, which is why it's applied at the overlay level too,
  // not just on the image.
  const onOverlayTouchStart = e => {
    e.stopPropagation();
    if (pdf || !imgLoaded) return;

    if (e.touches.length === 2) {
      gesture.current = {
        mode: 'pinch',
        startDist: dist(e.touches[0], e.touches[1]),
        startScale: scale,
        startMid: midpoint(e.touches[0], e.touches[1]),
        startPan: pan,
      };
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      const now = Date.now();
      const last = lastTapRef.current;
      const isDoubleTap =
        now - last.time < DOUBLE_TAP_MS &&
        Math.hypot(t.clientX - last.x, t.clientY - last.y) < 30;
      lastTapRef.current = { time: now, x: t.clientX, y: t.clientY };

      if (isDoubleTap) {
        lastTapRef.current = { time: 0, x: 0, y: 0 }; // consume — don't chain a third tap
        if (scale > MIN_SCALE) {
          resetZoom();
        } else {
          setScale(DOUBLE_TAP_SCALE);
          setPan({ x: 0, y: 0 });
        }
        gesture.current = null;
        return;
      }

      if (scale > MIN_SCALE) {
        gesture.current = { mode: 'pan', startX: t.clientX, startY: t.clientY, startPan: pan };
      }
    }
  };

  const onOverlayTouchMove = e => {
    e.stopPropagation();
    const g = gesture.current;
    if (!g) return;
    e.preventDefault(); // we're driving this gesture ourselves now

    if (g.mode === 'pinch' && e.touches.length === 2) {
      const newDist = dist(e.touches[0], e.touches[1]);
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, g.startScale * (newDist / g.startDist)));
      const mid = midpoint(e.touches[0], e.touches[1]);
      const dx = mid.x - g.startMid.x;
      const dy = mid.y - g.startMid.y;
      setScale(newScale);
      setPan(clampPan(g.startPan.x + dx, g.startPan.y + dy, newScale));
    } else if (g.mode === 'pan' && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - g.startX;
      const dy = t.clientY - g.startY;
      setPan(clampPan(g.startPan.x + dx, g.startPan.y + dy, scale));
    }
  };

  const onOverlayTouchEnd = e => {
    e.stopPropagation();
    gesture.current = null;
    // Snap back below the floor (e.g. a pinch that ended under 1x).
    setScale(s => {
      const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
      if (clamped === MIN_SCALE) setPan({ x: 0, y: 0 });
      return clamped;
    });
  };

  if (!url) return null;

  // Rendered via a portal straight onto document.body: the four student
  // tabs (Dashboard/Upload/Certificates/Tickets) are mounted side-by-side
  // in a horizontally-translated track for the swipe gesture, and CSS
  // `transform` on an ancestor creates a new containing block for any
  // `position: fixed` descendant. Without the portal, this modal's fixed
  // overlay would size/position itself against that (4x-viewport-wide)
  // track instead of the actual viewport — which is what made it look
  // like it was "opening across all four pages".
  //
  // IMPORTANT: a portal only detaches from the DOM tree, not the React
  // tree — touch events fired inside it still bubble to this component's
  // React ancestors (here, the swipeable tab track's own touch handlers),
  // even though this overlay isn't a DOM descendant of that track. Every
  // touch handler below calls stopPropagation() specifically to block
  // that bubbling, which is what keeps the background page from sliding
  // around while viewing or pinch-zooming a certificate.
  return createPortal(
    <div
      className="cert-modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onTouchStart={onOverlayTouchStart}
      onTouchMove={onOverlayTouchMove}
      onTouchEnd={onOverlayTouchEnd}
      onTouchCancel={onOverlayTouchEnd}
    >
      <div className="cert-modal-box">
        {/* Toolbar */}
        <div className="cert-modal-toolbar">
          <span className="cert-modal-filename">{fileName}</span>
          <div className="cert-modal-actions">
            <button
              className="cert-modal-btn"
              onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
              title="Open in a new tab"
            >
              <ExternalLink size={16}/> Open
            </button>
            <button
              className="cert-modal-btn download"
              onClick={() => triggerDownload(url, fileName)}
              title="Download file"
            >
              <Download size={16}/> Download
            </button>
            <button
              className="cert-modal-btn close"
              onClick={onClose}
              title="Close"
            >
              <X size={16}/>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="cert-modal-body" ref={bodyRef}>
          {pdf ? (
            <>
              <iframe
                src={url}
                title="Certificate PDF"
                className="cert-modal-iframe"
              />
              {showPdfFallback && (
                <div className="cert-modal-fallback-note">
                  <AlertTriangle size={14}/>
                  <span>Not seeing the PDF above? </span>
                  <button
                    type="button"
                    className="cert-modal-fallback-link"
                    onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                  >
                    Open it in a new tab instead
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {!imgLoaded && !imgFailed && (
                <div className="cert-modal-loading">
                  <Loader2 size={20} className="icon-spin" /> Loading…
                </div>
              )}
              {imgFailed ? (
                <div className="cert-modal-error">
                  <AlertTriangle size={20}/>
                  <span>This certificate image couldn't be loaded here.</span>
                  <button
                    type="button"
                    className="cert-modal-fallback-link"
                    onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                  >
                    Open it in a new tab instead
                  </button>
                </div>
              ) : (
                <img
                  ref={imgElRef}
                  src={url}
                  alt="Certificate"
                  className="cert-modal-img"
                  style={{
                    display: imgLoaded ? 'block' : 'none',
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                    transition: gesture.current ? 'none' : 'transform 0.2s ease',
                  }}
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgFailed(true)}
                  draggable={false}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
