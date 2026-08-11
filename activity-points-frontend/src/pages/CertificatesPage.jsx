import React, { useState, useEffect, useMemo } from 'react';
import axiosInstance from '../api/axiosInstance';
import {
  ArrowLeft, FileText, Calendar, Award,
  Eye, Download, CheckCircle, Clock, XCircle, Package, Trash2,
  UploadCloud, Loader2
} from 'lucide-react';
import '../css/certificatespage.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useStudentTabContext from '../context/StudentTabContext';
import CertModal from '../components/CertModal';
import CertCropModal from '../components/CertCropModal';
import { calcCappedPoints, passThreshold } from '../utils/calcPoints';
import { getCached, setCached, isSessionCached } from '../utils/pageDataCache';

const CACHE_KEY = 'certificatesPage';

export default function CertificatesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { refreshToken } = useStudentTabContext();
  const lastRefreshToken = React.useRef(refreshToken);

  const cached = getCached(CACHE_KEY);
  const [certificates, setCertificates] = useState(cached?.certificates ?? []);
  const [categories, setCategories]     = useState(cached?.categories ?? []);
  const [user, setUser]                 = useState(cached?.user ?? null);
  const [activeFilter, setActiveFilter] = useState('all');
  // Set from ?certId= on a notification deep-link, so the matching card
  // can be visually highlighted and scrolled to once the list renders.
  const [highlightedCertId, setHighlightedCertId] = useState(null);
  const [loading, setLoading]           = useState(!cached);
  const [error, setError]               = useState(null);
  const [modalUrl, setModalUrl]         = useState(null);
  const [modalFile, setModalFile]       = useState('');
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [deletingId, setDeletingId]     = useState(null);

  // Re-upload (rejected certificates only): id of the cert currently being
  // re-uploaded, plus a ref-map of hidden file inputs — one per rejected
  // card — so each card's button opens its own file picker.
  const [reuploadingId, setReuploadingId] = useState(null);
  const [reuploadError, setReuploadError] = useState({});
  // File the student has picked but not yet confirmed with Submit — keyed
  // by cert id, so a rejected cert shows its chosen file back to them
  // (with a Submit/Cancel choice) instead of uploading the instant a file
  // is selected, which previously gave no chance to double-check or back
  // out before it was sent for review.
  const [pendingReupload, setPendingReupload] = useState({});
  const [cropReupload, setCropReupload] = useState(null); // { certId, file }
  const fileInputRefs = React.useRef({});

  useEffect(() => {
    // Reuse cached data on a plain remount (e.g. swiping back to this tab);
    // only hit the network on first-ever load or when the global refresh
    // button bumps refreshToken.
    const isRefresh = refreshToken !== undefined && refreshToken !== lastRefreshToken.current;
    lastRefreshToken.current = refreshToken;
    // False on a cold start even though this component's top-level
    // getCached(CACHE_KEY) call (for instant paint) has already run —
    // that's just a passive read, not a real fetch, so it doesn't mark
    // the key session-fetched. See pageDataCache.js for why.
    const alreadySessionCached = isSessionCached(CACHE_KEY);
    const existing = getCached(CACHE_KEY);
    // A notification deep-link must never rely on the session cache: the
    // certificate may have been approved/rejected after that cache was built.
    const hasCertDeepLink = !!new URLSearchParams(window.location.search).get('certId');
    if (existing && !isRefresh && alreadySessionCached && !hasCertDeepLink) {
      setCertificates(existing.certificates);
      setCategories(existing.categories);
      setUser(existing.user);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const [certRes, catRes, userRes] = await Promise.all([
          axiosInstance.get('/certificates/my'),
          axiosInstance.get('/categories'),
          axiosInstance.get('/students/me'),
        ]);
        const nextCertificates = certRes.data.certificates || [];
        const nextCategories = catRes.data.categories || [];
        const nextUser = userRes.data;
        setCertificates(nextCertificates);
        setCategories(nextCategories);
        setUser(nextUser);
        setCached(CACHE_KEY, { certificates: nextCertificates, categories: nextCategories, user: nextUser });
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load certificates');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [refreshToken]);

  // Keeps the cached certificate list in sync with local mutations
  // (reupload, cancel/delete) so swiping away and back doesn't show
  // stale, already-mutated data from the cache.
  const updateCertificatesCache = (updater) => {
    const existing = getCached(CACHE_KEY);
    if (existing) {
      setCached(CACHE_KEY, { ...existing, certificates: updater(existing.certificates) });
    }
  };

  // Deep-link support: a certificate-status push notification's data.link
  // points here with ?certId=<id>&status=<status>. Once the list has
  // loaded, switch to that status tab, highlight the matching card, and
  // scroll it into view — then strip the params so they don't reapply on
  // later manual tab clicks.
  useEffect(() => {
    if (loading) return;
    const certId = searchParams.get('certId');
    const status = searchParams.get('status');
    if (!certId) return;

    if (status && ['all', 'approved', 'pending', 'rejected'].includes(status)) {
      setActiveFilter(status);
    }
    setHighlightedCertId(certId);
    setSearchParams({}, { replace: true });

    // The filter change and card render happen asynchronously. Retry for a
    // short window instead of assuming 150ms is enough, especially when the
    // notification opened the page from a cached/remounted dashboard.
    let attempts = 0;
    const scrollToCard = () => {
      const el = document.getElementById(`cert-card-${certId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (++attempts < 20) setTimeout(scrollToCard, 100);
    };
    const t = setTimeout(scrollToCard, 50);
    const clearHighlight = setTimeout(() => setHighlightedCertId(null), 4000);
    return () => { clearTimeout(t); clearTimeout(clearHighlight); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, certificates.length]);

  // Helpers
  const getCategoryById = (id) => {
    if (!id) return null;
    const searchId = id._id || id;
    return categories.find(c => c._id === searchId) || null;
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved': return <CheckCircle className="icon status-approved-icon" />;
      case 'pending':  return <Clock className="icon status-pending-icon" />;
      case 'rejected': return <XCircle className="icon status-rejected-icon" />;
      default:         return null;
    }
  };

  const getStatusColorClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'status-approved';
      case 'pending':  return 'status-pending';
      case 'rejected': return 'status-rejected';
      default:         return 'status-default';
    }
  };

  // Points display: approved = actual awarded, pending = potential
  const displayPoints = (cert) => {
    if (cert.status?.toLowerCase() === 'approved') return cert.pointsAwarded ?? 0;
    return cert.potentialPoints ?? 0;
  };

  // Capped total using correct SBTE Kerala rules
  const totalPoints = useMemo(() => {
    const approved = certificates.filter(c => c.status?.toLowerCase() === 'approved');
    return calcCappedPoints(approved, categories, user?.isLateralEntry ?? false);
  }, [certificates, categories, user]);

  const filteredCertificates = activeFilter === 'all'
    ? certificates
    : certificates.filter(c => c.status?.toLowerCase() === activeFilter);

  const openCertModal = (cert) => {
    const ext  = cert.fileUrl?.split('.').pop()?.split('?')[0] || 'jpg';
    const name = `${cert.subcategory || 'certificate'}.${ext}`;
    setModalFile(name);
    setModalUrl(cert.fileUrl);
  };

  const handleBulkDownload = async () => {
    const certsWithFiles = filteredCertificates.filter(c => c.fileUrl);
    if (!certsWithFiles.length) { alert('No files to download.'); return; }
    setBulkDownloading(true);
    try {
      for (const cert of certsWithFiles) {
        const ext  = cert.fileUrl?.split('.').pop()?.split('?')[0] || 'jpg';
        const name = `${cert.subcategory || 'cert'}_${cert.status}.${ext}`;
        try {
          const res  = await fetch(cert.fileUrl);
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl; a.download = name;
          document.body.appendChild(a); a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
          await new Promise(r => setTimeout(r, 400));
        } catch { window.open(cert.fileUrl, '_blank'); }
      }
    } finally {
      setBulkDownloading(false);
    }
  };

  const triggerReupload = (certId) => {
    fileInputRefs.current[certId]?.click();
  };

  // Step 1: file picked — validate and stage it for review, but don't
  // upload yet. The student confirms with the Submit button that now
  // appears next to the preview (or backs out with Cancel).
  const handleReuploadFileSelect = (cert, e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again later
    if (!file) return;

    const mime = file.type;
    const name = file.name.toLowerCase();
    const isImage = mime.startsWith('image/');
    const isPdf = mime === 'application/pdf' || name.endsWith('.pdf');
    if (!isImage && !isPdf) {
      alert('Only images (JPG, PNG, etc.) and PDF files are accepted as certificates.');
      return;
    }

    setReuploadError(prev => ({ ...prev, [cert._id]: '' }));

    // Images use the same real crop editor as certificate submission.
    // PDFs are already document-shaped, so they skip the image cropper.
    if (isImage) {
      setCropReupload({ certId: cert._id, file });
      return;
    }

    setPendingReupload(prev => ({
      ...prev,
      [cert._id]: { file, previewUrl: null },
    }));
  };

  const cancelReuploadCrop = () => setCropReupload(null);

  const confirmReuploadCrop = croppedFile => {
    if (!cropReupload) return;
    const certId = cropReupload.certId;
    setPendingReupload(prev => ({
      ...prev,
      [certId]: {
        file: croppedFile,
        previewUrl: URL.createObjectURL(croppedFile),
      },
    }));
    setCropReupload(null);
  };

  // Discard the staged file without uploading anything.
  const cancelReuploadSelection = (certId) => {
    setPendingReupload(prev => {
      if (prev[certId]?.previewUrl) URL.revokeObjectURL(prev[certId].previewUrl);
      const next = { ...prev };
      delete next[certId];
      return next;
    });
  };

  // Step 2: student hits Submit — actually send the staged file.
  const submitReupload = async (cert) => {
    const pending = pendingReupload[cert._id];
    if (!pending) return;

    setReuploadError(prev => ({ ...prev, [cert._id]: '' }));
    setReuploadingId(cert._id);
    try {
      const formData = new FormData();
      formData.append('file', pending.file);
      const res = await axiosInstance.put(`/certificates/${cert._id}/reupload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updated = res.data.certificate;
      const applyReupload = (list) => list.map(c => (c._id === cert._id ? {
        ...c,
        fileUrl: updated.fileUrl,
        fileId: updated.fileId,
        status: updated.status,
        rejectionReason: updated.rejectionReason,
        pointsAwarded: updated.pointsAwarded,
        updatedAt: updated.updatedAt,
      } : c));
      setCertificates(applyReupload);
      updateCertificatesCache(applyReupload);
      cancelReuploadSelection(cert._id); // clears the staged file/preview now that it's been sent
    } catch (err) {
      setReuploadError(prev => ({
        ...prev,
        [cert._id]: err.response?.data?.message || 'Re-upload failed. Please try again.',
      }));
    } finally {
      setReuploadingId(null);
    }
  };

  const handleCancelCert = async (cert) => {
    if (!window.confirm(`Cancel and delete "${cert.eventName || cert.subcategory || 'this certificate'}"? This cannot be undone.`)) return;
    setDeletingId(cert._id);
    try {
      await axiosInstance.delete(`/certificates/${cert._id}`);
      const applyDelete = (list) => list.filter(c => c._id !== cert._id);
      setCertificates(applyDelete);
      updateCertificatesCache(applyDelete);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel certificate. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="viewcertificates-container">
      {/* Certificate viewer modal */}
      {modalUrl && (
        <CertModal
          url={modalUrl}
          fileName={modalFile}
          onClose={() => { setModalUrl(null); setModalFile(''); }}
        />
      )}

      <CertCropModal
        file={cropReupload?.file}
        busy={false}
        onCancel={cancelReuploadCrop}
        onConfirm={confirmReuploadCrop}
      />

      <div className="header">
        <button onClick={() => navigate('/student')} className="back-button" aria-label="Back to dashboard">
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="summary-card">
        <div className="points-summary full-width">
          <p className="points">{totalPoints}</p>
          <p>Total Points (Capped)</p>
          <button
            type="button"
            className="points-explain-link"
            onClick={() => navigate('/student/points-explained')}
          >
            How is this calculated?
          </button>
        </div>
        <div className="certificates-count">
          <p>{certificates.length} certificate{certificates.length !== 1 ? 's' : ''} submitted</p>
        </div>
      </div>

      <div className="filters">
        {['all', 'approved', 'pending', 'rejected'].map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`filter-btn ${activeFilter === f ? 'active' : ''}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="filter-count">
                ({certificates.filter(c => c.status?.toLowerCase() === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk download */}
      {filteredCertificates.filter(c => c.fileUrl).length > 0 && (
        <div style={{ padding: '0 1rem 0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn-download"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}
            onClick={handleBulkDownload}
            disabled={bulkDownloading}
          >
            <Package size={14} />
            {bulkDownloading ? 'Downloading…' : `Download All (${filteredCertificates.filter(c => c.fileUrl).length})`}
          </button>
        </div>
      )}

      {loading && <p className="loading-text">Loading certificates...</p>}
      {error && <p className="error-text">{error}</p>}

      <div className="certificates-list">
        {!loading && filteredCertificates.length === 0 && (
          <div className="no-certificates">
            <FileText size={48} className="no-cert-icon" />
            <h3>No certificates found</h3>
            <p>
              {activeFilter === 'all'
                ? "You haven't submitted any certificates yet."
                : `No ${activeFilter} certificates.`}
            </p>
            {activeFilter === 'all' && (
              <button className="upload-first-btn" onClick={() => navigate('/student/upload-certificate')}>
                Upload Your First Certificate
              </button>
            )}
          </div>
        )}

        {!loading && filteredCertificates.map(cert => (
          <div
            key={cert._id}
            id={`cert-card-${cert._id}`}
            className={`certificate-card${highlightedCertId === cert._id ? ' cert-card-highlighted' : ''}`}
          >
            <div className="cert-header">
              <h3>{cert.subcategory || 'Certificate'}</h3>
              {getStatusIcon(cert.status)}
            </div>

            <div className="cert-category-subcat">
              <span className="category-badge">
                {cert.category?.name || getCategoryById(cert.category)?.name || '—'}
              </span>
            </div>

            {(cert.level || cert.prizeType) && (
              <div className="prize-level">
                <Award size={16} className="award-icon" />
                <span>
                  {cert.level ?? ''}{cert.level && cert.prizeType ? ' — ' : ''}{cert.prizeType ?? ''}
                </span>
              </div>
            )}

            <span className={`status-badge ${getStatusColorClass(cert.status)}`}>
              {cert.status ?? 'Unknown'}
            </span>

            <div className="cert-footer">
              <div className="dates-points">
                <div>
                  <Calendar size={16} />
                  <span>Submitted: {cert.createdAt ? new Date(cert.createdAt).toLocaleDateString() : '—'}</span>
                </div>
                <div>
                  <Award size={16} className="award-green" />
                  <span className="points-text">+{displayPoints(cert)} pts</span>
                </div>
              </div>

              {cert.fileUrl && (
                <div className="actions">
                  <button onClick={() => openCertModal(cert)} className="btn-view">
                    <Eye size={16} /> View
                  </button>
                  <button
                    className="btn-download"
                    onClick={async () => {
                      const ext  = cert.fileUrl?.split('.').pop()?.split('?')[0] || 'jpg';
                      const name = `${cert.subcategory || 'cert'}.${ext}`;
                      try {
                        const res = await fetch(cert.fileUrl);
                        const blob = await res.blob();
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl; a.download = name;
                        document.body.appendChild(a); a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(blobUrl);
                      } catch { window.open(cert.fileUrl, '_blank'); }
                    }}
                  >
                    <Download size={16} /> Download
                  </button>
                </div>
              )}
            </div>

            {cert.status?.toLowerCase() === 'rejected' && (
              <div className="rejected-reason">
                <div className="rejected-reason-header">
                  ❌ Certificate Rejected
                </div>
                <div className="rejected-reason-body">
                  <strong>Tutor's reason:</strong>{' '}
                  {cert.rejectionReason
                    ? cert.rejectionReason
                    : 'No reason provided. Please contact your tutor.'}
                </div>
                <div className="rejected-reason-action">
                  You can re-upload a corrected certificate — it'll be reviewed again under the same entry.
                </div>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  ref={el => (fileInputRefs.current[cert._id] = el)}
                  onChange={e => handleReuploadFileSelect(cert, e)}
                  style={{ display: 'none' }}
                />
                {pendingReupload[cert._id] ? (
                  <div className="cert-reupload-pending">
                    {pendingReupload[cert._id].previewUrl ? (
                      <img
                        src={pendingReupload[cert._id].previewUrl}
                        alt="Selected certificate preview"
                        className="cert-reupload-pending-thumb"
                      />
                    ) : (
                      <span className="cert-reupload-pending-filename">
                        <FileText size={14} /> {pendingReupload[cert._id].file.name}
                      </span>
                    )}
                    <div className="cert-reupload-pending-actions">
                      <button
                        type="button"
                        className="cert-reupload-submit-btn"
                        onClick={() => submitReupload(cert)}
                        disabled={reuploadingId === cert._id}
                      >
                        {reuploadingId === cert._id
                          ? <><Loader2 size={13} className="icon-spin" /> Submitting…</>
                          : <><UploadCloud size={13} /> Submit</>
                        }
                      </button>
                      <button
                        type="button"
                        className="cert-reupload-cancel-btn"
                        onClick={() => cancelReuploadSelection(cert._id)}
                        disabled={reuploadingId === cert._id}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="cert-reupload-btn"
                    onClick={() => triggerReupload(cert._id)}
                  >
                    <UploadCloud size={14} /> Re-upload Certificate
                  </button>
                )}
                {reuploadError[cert._id] && (
                  <p className="rejected-reason-error">{reuploadError[cert._id]}</p>
                )}
              </div>
            )}

            {cert.status?.toLowerCase() === 'pending' && (
              <button
                className="cert-cancel-btn"
                onClick={() => handleCancelCert(cert)}
                disabled={deletingId === cert._id}
              >
                <Trash2 size={14} />
                {deletingId === cert._id ? 'Cancelling…' : 'Cancel & Delete'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
