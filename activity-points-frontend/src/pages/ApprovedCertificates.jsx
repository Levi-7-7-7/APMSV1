import React, { useEffect, useState } from 'react';
import { Loader2, Award, Eye, RotateCcw } from 'lucide-react';
import tutorAxios from '../api/tutorAxios';
import CertModal from '../components/CertModal';
import '../css/ApprovedCertificates.css';

export default function ApprovedCertificates() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [modalUrl, setModalUrl]         = useState(null);
  const [modalFile, setModalFile]       = useState('');
  const [revertingId, setRevertingId]   = useState(null);
  const [confirmId, setConfirmId]       = useState(null);

  useEffect(() => {
    tutorAxios.get('/tutors/certificates')
      .then(res => {
        const approved = (res.data.certificates || []).filter(c => c.status === 'approved');
        setCertificates(approved);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  // Lock the background page scroll whenever a modal is open — otherwise
  // touch-scrolling inside the modal also scrolls the certificate list behind it.
  useEffect(() => {
    const anyModalOpen = !!(modalUrl || confirmId);
    if (anyModalOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prevOverflow; };
    }
  }, [modalUrl, confirmId]);

  const filtered = certificates.filter(c =>
    search
      ? c.student?.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.student?.registerNumber?.toLowerCase().includes(search.toLowerCase())
      : true
  );

  const openModal = (cert) => {
    const ext  = cert.fileUrl?.split('.').pop()?.split('?')[0] || 'jpg';
    const name = `${cert.student?.name || 'cert'}_${cert.subcategory || ''}.${ext}`;
    setModalFile(name);
    setModalUrl(cert.fileUrl);
  };

  const handleRevert = async (certId) => {
    setRevertingId(certId);
    setConfirmId(null);
    try {
      await tutorAxios.post(`/tutors/certificates/${certId}/revert-to-pending`);
      setCertificates(prev => prev.filter(c => c._id !== certId));
    } catch (err) {
      console.error('Revert failed:', err);
      alert(err?.response?.data?.error || 'Failed to revert certificate. Please try again.');
    } finally {
      setRevertingId(null);
    }
  };

  if (loading) return (
    <div className="approved-loading">
      <Loader2 className="spinner" />
      <p>Loading approved certificates...</p>
    </div>
  );

  return (
    <div className="approved-page">
      {modalUrl && (
        <CertModal
          url={modalUrl}
          fileName={modalFile}
          onClose={() => { setModalUrl(null); setModalFile(''); }}
        />
      )}

      {/* Confirm revert overlay */}
      {confirmId && (
        <div className="approved-confirm-backdrop">
          <div className="approved-confirm-modal">
            <h3 className="approved-confirm-title">Revert to Pending?</h3>
            <p className="approved-confirm-body">
              This will remove the awarded points and move the certificate back to pending review.
            </p>
            <div className="approved-confirm-actions">
              <button
                onClick={() => setConfirmId(null)}
                className="approved-confirm-btn cancel"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevert(confirmId)}
                className="approved-confirm-btn confirm"
              >
                Yes, Revert
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 className="approved-heading">Approved Certificates</h2>

      <input
        type="text"
        placeholder="Search by student name or reg. number..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="approved-search"
      />

      {filtered.length === 0 ? (
        <p className="approved-empty">
          {search ? 'No matching certificates found.' : 'No approved certificates yet.'}
        </p>
      ) : (
        <div className="approved-list">
          {filtered.map(cert => (
            <div key={cert._id} className="approved-card">
              <div className="approved-card-top">
                <div>
                  <p className="approved-student-name">{cert.student?.name || '—'}</p>
                  <p className="approved-reg-number">{cert.student?.registerNumber}</p>
                  <p className="approved-category-line">
                    <strong>{cert.category?.name}</strong> — {cert.subcategory}
                  </p>
                  {(cert.level || cert.prizeType) && (
                    <p className="approved-prize-line">
                      <Award size={13} />
                      {cert.level}{cert.level && cert.prizeType ? ' · ' : ''}{cert.prizeType}
                    </p>
                  )}
                </div>
                <div className="approved-side">
                  <div className="approved-points-chip">
                    +{cert.pointsAwarded} pts
                  </div>
                  {cert.fileUrl && (
                    <button onClick={() => openModal(cert)} className="approved-view-btn">
                      <Eye size={12} /> View
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmId(cert._id)}
                    disabled={revertingId === cert._id}
                    className="approved-revert-btn"
                  >
                    {revertingId === cert._id
                      ? <><Loader2 size={12} className="spin" /> Reverting...</>
                      : <><RotateCcw size={12} /> Revert to Pending</>
                    }
                  </button>
                </div>
              </div>
              <p className="approved-date">
                Approved: {new Date(cert.updatedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
