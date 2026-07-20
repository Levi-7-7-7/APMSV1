import React, { useState, useEffect, useMemo } from 'react';
import axiosInstance from '../api/axiosInstance';
import {
  ArrowLeft, FileText, Calendar, Award,
  Eye, Download, CheckCircle, Clock, XCircle, Package, Trash2,
  UploadCloud, Loader2
} from 'lucide-react';
import '../css/certificatespage.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CertModal from '../components/CertModal';
import { calcCappedPoints, passThreshold } from '../utils/calcPoints';

export default function CertificatesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [certificates, setCertificates] = useState([]);
  const [categories, setCategories]     = useState([]);
  const [user, setUser]                 = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  // Set from ?certId= on a notification deep-link, so the matching card
  // can be visually highlighted and scrolled to once the list renders.
  const [highlightedCertId, setHighlightedCertId] = useState(null);
  const [loading, setLoading]           = useState(true);
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
  const fileInputRefs = React.useRef({});

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [certRes, catRes, userRes] = await Promise.all([
          axiosInstance.get('/certificates/my'),
          axiosInstance.get('/categories'),
          axiosInstance.get('/students/me'),
        ]);
        setCertificates(certRes.data.certificates || []);
        setCategories(catRes.data.categories || []);
        setUser(userRes.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load certificates');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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

    // Scroll to the card shortly after the filter/render settles.
    const t = setTimeout(() => {
      document.getElementById(`cert-card-${certId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
    // Drop the highlight after a few seconds so it doesn't linger forever.
    const clearHighlight = setTimeout(() => setHighlightedCertId(null), 4000);
    return () => { clearTimeout(t); clearTimeout(clearHighlight); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

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

  const handleReuploadFile = async (cert, e) => {
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
    setReuploadingId(cert._id);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axiosInstance.put(`/certificates/${cert._id}/reupload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updated = res.data.certificate;
      setCertificates(prev => prev.map(c => (c._id === cert._id ? {
        ...c,
        fileUrl: updated.fileUrl,
        fileId: updated.fileId,
        status: updated.status,
        rejectionReason: updated.rejectionReason,
        pointsAwarded: updated.pointsAwarded,
        updatedAt: updated.updatedAt,
      } : c)));
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
      setCertificates(prev => prev.filter(c => c._id !== cert._id));
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

      <div className="header">
        <button onClick={() => navigate('/student')} className="back-button" aria-label="Back to dashboard">
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="summary-card">
        <div className="points-summary full-width">
          <p className="points">{totalPoints}</p>
          <p>Total Points (Capped)</p>
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
                  onChange={e => handleReuploadFile(cert, e)}
                  style={{ display: 'none' }}
                />
                <button
                  className="cert-reupload-btn"
                  onClick={() => triggerReupload(cert._id)}
                  disabled={reuploadingId === cert._id}
                >
                  {reuploadingId === cert._id
                    ? <><Loader2 size={14} className="spin" /> Re-uploading…</>
                    : <><UploadCloud size={14} /> Re-upload Certificate</>
                  }
                </button>
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
