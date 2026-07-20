/**
 * CertCropModal — crop tool shown after a student picks a certificate
 * IMAGE (not PDF). Unlike PhotoCropModal's circular 1:1 avatar crop, this
 * uses a rectangular mask that matches the picked image's own aspect
 * ratio, so certificates (which are rarely square) aren't forced into a
 * fixed shape. Drag to reposition, slider to zoom in — or just confirm
 * with no changes to use the certificate as-is, same as the profile flow.
 *
 * Output keeps the certificate's native resolution (so text stays legible),
 * capped at MAX_OUTPUT_LONG_SIDE on the longest side to keep file sizes
 * reasonable. A separate compression pass (see compressCertImage) handles
 * anything still over the 2MB limit.
 *
 * Usage:
 *   <CertCropModal
 *     file={pendingImageFile}
 *     busy={compressing}
 *     onCancel={() => {...}}
 *     onConfirm={(croppedFile) => {...}}
 *   />
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, X, ZoomIn } from 'lucide-react';
import '../css/CertCropModal.css';

// Bounding box the crop stage is fit inside (preserves image aspect ratio).
const MAX_STAGE_W = 320;
const MAX_STAGE_H = 420;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const MAX_OUTPUT_LONG_SIDE = 1600;
const OUTPUT_QUALITY = 0.92;

export default function CertCropModal({ file, busy, error, onCancel, onConfirm }) {
  const [imgUrl, setImgUrl] = useState(null);
  const [imgSize, setImgSize] = useState(null); // natural width/height
  const [stage, setStage] = useState(null); // { w, h } on-screen stage size
  const [baseScale, setBaseScale] = useState(1); // scale that makes image fill the stage
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  const dragRef = useRef(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgUrl(url);

    const img = new Image();
    img.onload = () => {
      const ar = img.naturalWidth / img.naturalHeight;
      let stageW, stageH;
      if (ar >= MAX_STAGE_W / MAX_STAGE_H) {
        stageW = MAX_STAGE_W;
        stageH = MAX_STAGE_W / ar;
      } else {
        stageH = MAX_STAGE_H;
        stageW = MAX_STAGE_H * ar;
      }

      // Mask aspect ratio matches the image's own aspect ratio (no
      // letterboxing), so at zoom 1 the image exactly fills the stage.
      const cover = stageW / img.naturalWidth;

      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setStage({ w: stageW, h: stageH });
      setBaseScale(cover);
      setZoom(1);
      setPos({ x: 0, y: 0 });
      setReady(true);
    };
    img.src = url;

    return () => {
      URL.revokeObjectURL(url);
      setReady(false);
    };
  }, [file]);

  const scale = baseScale * zoom;

  const clamp = useCallback(
    (x, y, s) => {
      if (!imgSize || !stage) return { x, y };
      const dispW = imgSize.w * s;
      const dispH = imgSize.h * s;
      const minX = Math.min(0, stage.w - dispW);
      const minY = Math.min(0, stage.h - dispH);
      return {
        x: Math.min(0, Math.max(minX, x)),
        y: Math.min(0, Math.max(minY, y)),
      };
    },
    [imgSize, stage]
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
    if (!ready || !imgUrl || !imgSize || !stage) return;

    const img = new Image();
    img.onload = () => {
      // Map the visible stage region back to natural image coordinates.
      const sx = -pos.x / scale;
      const sy = -pos.y / scale;
      const sw = stage.w / scale;
      const sh = stage.h / scale;

      // Keep native resolution for legibility, capped on the longest side.
      let outW = sw;
      let outH = sh;
      const longSide = Math.max(outW, outH);
      if (longSide > MAX_OUTPUT_LONG_SIDE) {
        const r = MAX_OUTPUT_LONG_SIDE / longSide;
        outW *= r;
        outH *= r;
      }
      outW = Math.round(outW);
      outH = Math.round(outH);

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

      canvas.toBlob(
        blob => {
          if (!blob) return;
          const cropped = new File([blob], file?.name || 'certificate.jpg', { type: 'image/jpeg' });
          onConfirm(cropped);
        },
        'image/jpeg',
        OUTPUT_QUALITY
      );
    };
    img.src = imgUrl;
  };

  if (!file) return null;

  return (
    <div className="ccm-backdrop" onClick={() => !busy && onCancel()}>
      <div className="ccm-modal" onClick={e => e.stopPropagation()}>
        <h3 className="ccm-title">Adjust certificate</h3>
        <p className="ccm-subtitle">Drag to reposition, use the slider to zoom — or just confirm to use it as-is.</p>

        <div
          className="ccm-stage"
          style={stage ? { width: stage.w, height: stage.h } : undefined}
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
              className="ccm-image"
              draggable={false}
              style={{
                width: imgSize.w * scale,
                height: imgSize.h * scale,
                transform: `translate(${pos.x}px, ${pos.y}px)`,
              }}
            />
          )}
          <div className="ccm-frame-mask" />
        </div>

        <div className="ccm-zoom-row">
          <ZoomIn size={16} className="ccm-zoom-icon" />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={handleZoomChange}
            className="ccm-zoom-slider"
            disabled={!ready}
            aria-label="Zoom"
          />
        </div>

        {error && <div className="ccm-error">{error}</div>}

        <div className="ccm-actions">
          <button type="button" className="ccm-btn secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="ccm-btn primary"
            onClick={handleConfirm}
            disabled={busy || !ready}
          >
            {busy ? <Loader2 size={16} className="spin" /> : 'Use this image'}
          </button>
        </div>

        <button className="ccm-close" onClick={onCancel} aria-label="Cancel" type="button" disabled={busy}>
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
