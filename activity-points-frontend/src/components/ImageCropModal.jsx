import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, ZoomIn, RotateCcw } from 'lucide-react';
import '../css/ImageCropModal.css';

const MIN_CROP_SIZE = 56;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

function clampCrop(rect, stage, minSize = MIN_CROP_SIZE) {
  const maxW = stage.w;
  const maxH = stage.h;
  const w = Math.min(Math.max(rect.w, minSize), maxW);
  const h = Math.min(Math.max(rect.h, minSize), maxH);
  return {
    x: Math.min(Math.max(rect.x, 0), maxW - w),
    y: Math.min(Math.max(rect.y, 0), maxH - h),
    w,
    h,
  };
}

export default function ImageCropModal({
  file,
  busy = false,
  error = '',
  onCancel,
  onConfirm,
  title = 'Crop image',
  subtitle = 'Drag the image, move the crop area, or grab a corner to resize it.',
  shape = 'rectangle',
  maxStageW = 320,
  maxStageH = 320,
  maxOutputLongSide = 1600,
  outputSize = null,
  outputQuality = 0.92,
  outputName = 'cropped.jpg',
}) {
  const [imgUrl, setImgUrl] = useState(null);
  const [imgSize, setImgSize] = useState(null);
  const [stage, setStage] = useState(null);
  const [baseScale, setBaseScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [crop, setCrop] = useState(null);
  const [ready, setReady] = useState(false);
  const interactionRef = useRef(null);

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    setReady(false);

    const img = new Image();
    img.onload = () => {
      const ar = img.naturalWidth / img.naturalHeight;
      let stageW = maxStageW;
      let stageH = maxStageH;
      if (ar >= stageW / stageH) stageH = stageW / ar;
      else stageW = stageH * ar;

      // The image initially covers the entire stage.
      const cover = Math.max(stageW / img.naturalWidth, stageH / img.naturalHeight);
      const dispW = img.naturalWidth * cover;
      const dispH = img.naturalHeight * cover;
      const initialCrop = clampCrop({
        x: stageW * 0.1,
        y: stageH * 0.1,
        w: stageW * 0.8,
        h: stageH * 0.8,
      }, { w: stageW, h: stageH });

      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setStage({ w: stageW, h: stageH });
      setBaseScale(cover);
      setZoom(1);
      setPos({ x: (stageW - dispW) / 2, y: (stageH - dispH) / 2 });
      setCrop(initialCrop);
      setReady(true);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, maxStageW, maxStageH]);

  const scale = baseScale * zoom;

  const imageBounds = useCallback((s = scale, cropRect = crop) => {
    if (!imgSize || !stage) return null;
    const w = imgSize.w * s;
    const h = imgSize.h * s;
    // The image must cover the crop rectangle at all times.
    const minX = Math.min(0, cropRect ? cropRect.x + cropRect.w - w : stage.w - w);
    const maxX = Math.max(0, cropRect ? cropRect.x : 0);
    const minY = Math.min(0, cropRect ? cropRect.y + cropRect.h - h : stage.h - h);
    const maxY = Math.max(0, cropRect ? cropRect.y : 0);
    return { w, h, minX, maxX, minY, maxY };
  }, [imgSize, stage, crop, scale]);

  const clampImage = useCallback((x, y, s = scale, cropRect = crop) => {
    const b = imageBounds(s, cropRect);
    if (!b) return { x, y };
    return {
      x: Math.min(b.maxX, Math.max(b.minX, x)),
      y: Math.min(b.maxY, Math.max(b.minY, y)),
    };
  }, [imageBounds, scale, crop]);

  const startInteraction = (e, type, corner = null) => {
    if (!ready || busy) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    interactionRef.current = {
      type,
      corner,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startPos: { ...pos },
      startCrop: { ...crop },
    };
  };

  const handleStagePointerDown = e => startInteraction(e, 'image');
  const handleCropPointerDown = e => startInteraction(e, 'crop');
  const handleHandlePointerDown = (e, corner) => startInteraction(e, 'resize', corner);

  const handlePointerMove = e => {
    const i = interactionRef.current;
    if (!i || !stage || !crop) return;
    const dx = e.clientX - i.startX;
    const dy = e.clientY - i.startY;

    if (i.type === 'image') {
      setPos(clampImage(i.startPos.x + dx, i.startPos.y + dy));
      return;
    }

    if (i.type === 'crop') {
      const next = clampCrop({ ...i.startCrop, x: i.startCrop.x + dx, y: i.startCrop.y + dy }, stage);
      setCrop(next);
      setPos(p => clampImage(p.x, p.y, scale, next));
      return;
    }

    const c = i.startCrop;
    let next = { ...c };
    const corner = i.corner;
    if (corner.includes('l')) {
      next.x = Math.min(c.x + c.w - MIN_CROP_SIZE, Math.max(0, c.x + dx));
      next.w = c.x + c.w - next.x;
    }
    if (corner.includes('r')) {
      next.w = Math.max(MIN_CROP_SIZE, Math.min(stage.w - c.x, c.w + dx));
    }
    if (corner.includes('t')) {
      next.y = Math.min(c.y + c.h - MIN_CROP_SIZE, Math.max(0, c.y + dy));
      next.h = c.y + c.h - next.y;
    }
    if (corner.includes('b')) {
      next.h = Math.max(MIN_CROP_SIZE, Math.min(stage.h - c.y, c.h + dy));
    }
    next = clampCrop(next, stage);
    setCrop(next);
    setPos(p => clampImage(p.x, p.y, scale, next));
  };

  const endInteraction = e => {
    const i = interactionRef.current;
    if (i && e.currentTarget.releasePointerCapture) {
      try { e.currentTarget.releasePointerCapture(i.pointerId); } catch { /* noop */ }
    }
    interactionRef.current = null;
  };

  const handleZoomChange = e => {
    const newZoom = Number(e.target.value);
    const oldScale = scale;
    const newScale = baseScale * newZoom;
    const centerX = pos.x + (imgSize.w * oldScale) / 2;
    const centerY = pos.y + (imgSize.h * oldScale) / 2;
    setZoom(newZoom);
    setPos(clampImage(centerX - (imgSize.w * newScale) / 2, centerY - (imgSize.h * newScale) / 2, newScale));
  };

  const resetCrop = () => {
    if (!stage || !imgSize) return;
    const initial = clampCrop({
      x: stage.w * 0.1,
      y: stage.h * 0.1,
      w: stage.w * 0.8,
      h: stage.h * 0.8,
    }, stage);
    const s = baseScale;
    const dispW = imgSize.w * s;
    const dispH = imgSize.h * s;
    setZoom(1);
    setCrop(initial);
    setPos(clampImage((stage.w - dispW) / 2, (stage.h - dispH) / 2, s, initial));
  };

  const handleConfirm = () => {
    if (!ready || !imgUrl || !imgSize || !stage || !crop) return;
    const img = new Image();
    img.onload = () => {
      const sx = (crop.x - pos.x) / scale;
      const sy = (crop.y - pos.y) / scale;
      const sw = crop.w / scale;
      const sh = crop.h / scale;

      let outW;
      let outH;
      if (outputSize) {
        outW = outputSize;
        outH = outputSize;
      } else {
        outW = sw;
        outH = sh;
        const longSide = Math.max(outW, outH);
        if (longSide > maxOutputLongSide) {
          const r = maxOutputLongSide / longSide;
          outW *= r;
          outH *= r;
        }
        outW = Math.max(1, Math.round(outW));
        outH = Math.max(1, Math.round(outH));
      }

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
      canvas.toBlob(blob => {
        if (!blob) return;
        onConfirm(new File([blob], file?.name || outputName, { type: 'image/jpeg' }));
      }, 'image/jpeg', outputQuality);
    };
    img.src = imgUrl;
  };

  if (!file) return null;

  const stopTouchBubble = e => e.stopPropagation();
  const corners = ['tl', 'tr', 'bl', 'br'];

  return createPortal(
    <div
      className="imc-backdrop"
      onClick={() => !busy && onCancel()}
      onTouchStart={stopTouchBubble}
      onTouchMove={stopTouchBubble}
      onTouchEnd={stopTouchBubble}
      onTouchCancel={stopTouchBubble}
    >
      <div className="imc-modal" onClick={e => e.stopPropagation()}>
        <h3 className="imc-title">{title}</h3>
        <p className="imc-subtitle">{subtitle}</p>

        <div
          className={`imc-stage ${shape === 'circle' ? 'imc-stage-circle' : ''}`}
          style={stage ? { width: stage.w, height: stage.h } : undefined}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endInteraction}
          onPointerCancel={endInteraction}
        >
          {imgUrl && imgSize && (
            <img
              src={imgUrl}
              alt="Crop preview"
              className="imc-image"
              draggable={false}
              style={{
                width: imgSize.w * scale,
                height: imgSize.h * scale,
                transform: `translate(${pos.x}px, ${pos.y}px)`,
              }}
            />
          )}

          {crop && (
            <div
              className={`imc-crop-box ${shape === 'circle' ? 'imc-crop-circle-preview' : ''}`}
              style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
              onPointerDown={handleCropPointerDown}
            >
              <div className="imc-shade" />
              <div className="imc-grid" />
              {corners.map(corner => (
                <button
                  key={corner}
                  type="button"
                  aria-label={`Resize crop ${corner}`}
                  className={`imc-handle imc-handle-${corner}`}
                  onPointerDown={e => handleHandlePointerDown(e, corner)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="imc-help-row">
          <span>↔ Drag image</span>
          <span>↙ Drag corners</span>
          <span>⊙ Move crop</span>
        </div>

        <div className="imc-zoom-row">
          <ZoomIn size={16} />
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step="0.01"
            value={zoom}
            onChange={handleZoomChange}
            disabled={!ready || busy}
            aria-label="Zoom"
          />
          <button type="button" className="imc-reset" onClick={resetCrop} disabled={!ready || busy} title="Reset crop">
            <RotateCcw size={15} />
          </button>
        </div>

        {error && <div className="imc-error">{error}</div>}

        <div className="imc-actions">
          <button type="button" className="imc-btn secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="imc-btn primary" onClick={handleConfirm} disabled={busy || !ready}>
            {busy ? <> <Loader2 size={16} className="icon-spin" /> Uploading... </> : 'Use this crop'}
          </button>
        </div>

        <button className="imc-close" onClick={onCancel} aria-label="Cancel" type="button" disabled={busy}><X size={18} /></button>
      </div>
    </div>,
    document.body
  );
}
