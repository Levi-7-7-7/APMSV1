/**
 * PhotoCropModal — interactive circular crop tool shown after picking a
 * profile photo. Lets the user drag to reposition and use a slider to
 * zoom, so the exported image matches exactly what will be shown in the
 * circular avatar everywhere else in the app.
 *
 * Usage:
 *   <PhotoCropModal
 *     file={pendingFile}
 *     uploading={uploading}
 *     error={error}
 *     onCancel={() => {...}}
 *     onConfirm={(croppedFile) => {...}}
 *   />
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, X, ZoomIn } from 'lucide-react';
import '../css/PhotoCropModal.css';

// Size (px) of the square crop stage shown on screen.
const STAGE_SIZE = 260;
// Size (px) of the exported square image (matches native app: 600x600).
const OUTPUT_SIZE = 600;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export default function PhotoCropModal({ file, uploading, error, onCancel, onConfirm }) {
  const [imgUrl, setImgUrl] = useState(null);
  const [imgSize, setImgSize] = useState(null); // natural width/height
  const [baseScale, setBaseScale] = useState(1); // scale that makes image "cover" the stage
  const [zoom, setZoom] = useState(1); // multiplier on top of baseScale
  const [pos, setPos] = useState({ x: 0, y: 0 }); // image top-left, in stage px
  const [ready, setReady] = useState(false);

  const dragRef = useRef(null); // { startX, startY, startPosX, startPosY, pointerId }

  // Load the picked file into an object URL and read its natural size.
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgUrl(url);

    const img = new Image();
    img.onload = () => {
      const cover = Math.max(STAGE_SIZE / img.naturalWidth, STAGE_SIZE / img.naturalHeight);
      const dispW = img.naturalWidth * cover;
      const dispH = img.naturalHeight * cover;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setBaseScale(cover);
      setZoom(1);
      setPos({ x: (STAGE_SIZE - dispW) / 2, y: (STAGE_SIZE - dispH) / 2 });
      setReady(true);
    };
    img.src = url;

    return () => {
      URL.revokeObjectURL(url);
      setReady(false);
    };
  }, [file]);

  const scale = baseScale * zoom;

  // Keep the image covering the whole circular stage, whatever the
  // current pan/zoom is.
  const clamp = useCallback(
    (x, y, s) => {
      if (!imgSize) return { x, y };
      const dispW = imgSize.w * s;
      const dispH = imgSize.h * s;
      const minX = Math.min(0, STAGE_SIZE - dispW);
      const minY = Math.min(0, STAGE_SIZE - dispH);
      return {
        x: Math.min(0, Math.max(minX, x)),
        y: Math.min(0, Math.max(minY, y)),
      };
    },
    [imgSize]
  );

  const handlePointerDown = e => {
    if (!ready) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
      pointerId: e.pointerId,
    };
  };

  const handlePointerMove = e => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos(clamp(dragRef.current.startPosX + dx, dragRef.current.startPosY + dy, scale));
  };

  const endDrag = e => {
    if (dragRef.current && e.currentTarget.releasePointerCapture) {
      try {
        e.currentTarget.releasePointerCapture(dragRef.current.pointerId);
      } catch {
        /* no-op */
      }
    }
    dragRef.current = null;
  };

  // Zoom via slider, keeping the visual center of the crop fixed.
  const handleZoomChange = e => {
    const newZoom = Number(e.target.value);
    const newScale = baseScale * newZoom;
    const oldDispW = imgSize.w * scale;
    const oldDispH = imgSize.h * scale;
    const centerX = pos.x + oldDispW / 2;
    const centerY = pos.y + oldDispH / 2;
    const newDispW = imgSize.w * newScale;
    const newDispH = imgSize.h * newScale;
    const newPos = clamp(centerX - newDispW / 2, centerY - newDispH / 2, newScale);
    setZoom(newZoom);
    setPos(newPos);
  };

  const handleConfirm = () => {
    if (!ready || !imgUrl || !imgSize) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');

      // Map the visible stage region back to natural image coordinates.
      const sx = -pos.x / scale;
      const sy = -pos.y / scale;
      const sSize = STAGE_SIZE / scale;

      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      canvas.toBlob(
        blob => {
          if (!blob) return;
          const cropped = new File([blob], file?.name || 'profile.jpg', { type: 'image/jpeg' });
          onConfirm(cropped);
        },
        'image/jpeg',
        0.9
      );
    };
    img.src = imgUrl;
  };

  if (!file) return null;

  return (
    <div className="pcm-backdrop" onClick={() => !uploading && onCancel()}>
      <div className="pcm-modal" onClick={e => e.stopPropagation()}>
        <h3 className="pcm-title">Adjust photo</h3>
        <p className="pcm-subtitle">Drag to reposition, use the slider to zoom.</p>

        <div
          className="pcm-stage"
          style={{ width: STAGE_SIZE, height: STAGE_SIZE }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onPointerCancel={endDrag}
        >
          {imgUrl && imgSize && (
            <img
              src={imgUrl}
              alt="Crop preview"
              className="pcm-image"
              draggable={false}
              style={{
                width: imgSize.w * scale,
                height: imgSize.h * scale,
                transform: `translate(${pos.x}px, ${pos.y}px)`,
              }}
            />
          )}
          <div className="pcm-circle-mask" />
        </div>

        <div className="pcm-zoom-row">
          <ZoomIn size={16} className="pcm-zoom-icon" />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={handleZoomChange}
            className="pcm-zoom-slider"
            disabled={!ready}
            aria-label="Zoom"
          />
        </div>

        {error && <div className="pcm-error">{error}</div>}

        <div className="pcm-actions">
          <button type="button" className="pcm-btn secondary" onClick={onCancel} disabled={uploading}>
            Cancel
          </button>
          <button
            type="button"
            className="pcm-btn primary"
            onClick={handleConfirm}
            disabled={uploading || !ready}
          >
            {uploading ? <Loader2 size={16} className="spin" /> : 'Use this photo'}
          </button>
        </div>

        <button className="pcm-close" onClick={onCancel} aria-label="Cancel" type="button" disabled={uploading}>
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
