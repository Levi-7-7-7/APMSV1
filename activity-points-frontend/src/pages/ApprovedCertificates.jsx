import React, { useEffect, useState } from 'react';
import { Loader2, Award, Eye } from 'lucide-react';
import tutorAxios from '../api/tutorAxios';
import CertModal from '../components/CertModal';

export default function ApprovedCertificates() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [modalUrl, setModalUrl]         = useState(null);
  const [modalFile, setModalFile]       = useState('');

  useEffect(() => {
    tutorAxios.get('/tutors/certificates')
      .then(res => {
        const approved = (res.data.certificates || []).filter(c => c.status === 'approved');
        setCertificates(approved);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <Loader2 style={{ animation: 'spin 1s linear infinite' }} />
      <p>Loading approved certificates…</p>
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

      <h2 style={{ marginBottom: '1rem' }}>Approved Certificates</h2>

      <input
        type="text"
        placeholder="Search by student name or reg. number…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '0.6rem 1rem', marginBottom: '1rem',
          border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem'
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
                    /* FIX: opens inline modal instead of new tab */
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
