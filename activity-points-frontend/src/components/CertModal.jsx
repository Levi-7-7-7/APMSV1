/**
 * CertModal — inline image / PDF viewer with real download
 * 
 * Usage:
 *   <CertModal url={cert.fileUrl} fileName="certificate.jpg" onClose={() => setOpen(false)} />
 */
import React, { useEffect } from 'react';
import { X, Download, Loader2 } from 'lucide-react';

// Determine if a URL points to a PDF
function isPdf(url = '') {
  return url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('application/pdf');
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
  // Close on Escape key
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

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
          {isPdf(url) ? (
            <iframe
              src={url}
              title="Certificate PDF"
              className="cert-modal-iframe"
            />
          ) : (
            <img
              src={url}
              alt="Certificate"
              className="cert-modal-img"
            />
          )}
        </div>
      </div>
    </div>
  );
}
