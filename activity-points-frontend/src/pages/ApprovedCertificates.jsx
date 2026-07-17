import React, { useEffect, useState } from 'react';
import { Loader2, Award, Eye, RotateCcw } from 'lucide-react';
import tutorAxios from '../api/tutorAxios';
import CertModal from '../components/CertModal';

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
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <Loader2 style={{ animation: 'spin 1s linear infinite' }} />
      <p>Loading approved certificates...</p>
    </div>
  );

  return (
    <div style={{ padding: '1rem' }}>
      {modalUrl && (
        <CertModal
          url={modalUrl}
          fileName={modalFile}
          onClose={() => { setModalUrl(null); setModalFile(''); }}
        />
      )}

      {/* Confirm revert overlay */}
      {confirmId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem'
        }}>
          <div style={{
            background: '#fff', borderRadius: '12px', padding: '1.5rem',
            maxWidth: '340px', width: '100%', boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 700 }}>
              Revert to Pending?
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#6b7280', margin: '0 0 1.25rem' }}>
              This will remove the awarded points and move the certificate back to pending review.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setConfirmId(null)}
                style={{
                  flex: 1, padding: '0.6rem', borderRadius: '8px',
                  border: '1px solid #d1d5db', background: '#f9fafb',
                  cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevert(confirmId)}
                style={{
                  flex: 1, padding: '0.6rem', borderRadius: '8px',
                  border: 'none', background: '#f59e0b', color: '#fff',
                  cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem'
                }}
              >
                Yes, Revert
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 style={{ marginBottom: '1rem' }}>Approved Certificates</h2>

      <input
        type="text"
        placeholder="Search by student name or reg. number..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '0.6rem 1rem', marginBottom: '1rem',
          border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem',
          boxSizing: 'border-box'
        }}
      />

      {filtered.length === 0 ? (
        <p style={{ color: '#6b7280', textAlign: 'center', marginTop: '2rem' }}>
          {search ? 'No matching certificates found.' : 'No approved certificates yet.'}
        </p>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {filtered.map(cert => (
            <div key={cert._id} style={{
              background: '#fff', border: '1px solid #e5e7eb',
              borderLeft: '4px solid #22c55e', borderRadius: '8px', padding: '1rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontWeight: 600, margin: 0 }}>{cert.student?.name || '—'}</p>
                  <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '2px 0' }}>
                    {cert.student?.registerNumber}
                  </p>
                  <p style={{ fontSize: '0.9rem', margin: '4px 0' }}>
                    <strong>{cert.category?.name}</strong> — {cert.subcategory}
                  </p>
                  {(cert.level || cert.prizeType) && (
                    <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '2px 0' }}>
                      <Award size={13} style={{ verticalAlign: 'middle' }} />{' '}
                      {cert.level}{cert.level && cert.prizeType ? ' · ' : ''}{cert.prizeType}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                  <div style={{
                    background: '#dcfce7', color: '#15803d',
                    padding: '4px 10px', borderRadius: '20px',
                    fontWeight: 700, fontSize: '0.95rem'
                  }}>
                    +{cert.pointsAwarded} pts
                  </div>
                  {cert.fileUrl && (
                    <button
                      onClick={() => openModal(cert)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        fontSize: '0.8rem', color: '#2563eb', background: 'none',
                        border: '1px solid #bfdbfe', borderRadius: '6px',
                        padding: '3px 8px', cursor: 'pointer'
                      }}
                    >
                      <Eye size={12}/> View
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmId(cert._id)}
                    disabled={revertingId === cert._id}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      fontSize: '0.8rem', color: '#b45309',
                      background: revertingId === cert._id ? '#fef3c7' : '#fffbeb',
                      border: '1px solid #fcd34d', borderRadius: '6px',
                      padding: '3px 8px', cursor: revertingId === cert._id ? 'not-allowed' : 'pointer',
                      opacity: revertingId === cert._id ? 0.7 : 1
                    }}
                  >
                    {revertingId === cert._id
                      ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }}/> Reverting...</>
                      : <><RotateCcw size={12}/> Revert to Pending</>
                    }
                  </button>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '6px 0 0' }}>
                Approved: {new Date(cert.updatedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
