/**
 * CertModal — inline image / PDF viewer with real download
 * 
 * Usage:
 *   <CertModal url={cert.fileUrl} fileName="certificate.jpg" onClose={() => setOpen(false)} />
 */
import React, { useEffect, useState } from 'react';
import { X, Download, Loader2, ExternalLink, AlertTriangle } from 'lucide-react';

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

  // Close on Escape key
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Reset per-file load state whenever a different certificate is opened.
  useEffect(() => {
    setImgFailed(false);
    setImgLoaded(false);
    setShowPdfFallback(false);
    if (pdf) {
      const t = setTimeout(() => setShowPdfFallback(true), 2500);
      return () => clearTimeout(t);
    }
  }, [url, pdf]);

  if (!url) return null;

  return (
    <div
      className="cert-modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
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
        <div className="cert-modal-body">
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
                  <Loader2 size={20} className="spin" /> Loading…
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
                  src={url}
                  alt="Certificate"
                  className="cert-modal-img"
                  style={{ display: imgLoaded ? 'block' : 'none' }}
                  onLoad={() => setImgLoaded(true)}
                  onError={() => setImgFailed(true)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
