import React, { useEffect, useState } from 'react';
import { Loader2, Award, Eye, AlertCircle, X, Edit2, Check } from 'lucide-react';
import tutorAxios from '../api/tutorAxios';
import CertModal from '../components/CertModal';
import '../css/PendingCertificates.css';

const PendingCertificates = () => {
  const [pendingCerts, setPendingCerts]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [processingId, setProcessingId]   = useState(null);
  const [modalUrl, setModalUrl]           = useState(null);
  const [modalFile, setModalFile]         = useState('');
  const [categories, setCategories]       = useState([]);

  // Reject modal state
  const [rejectingCert, setRejectingCert] = useState(null);
  const [rejectReason, setRejectReason]   = useState('');
  const [rejectError, setRejectError]     = useState('');

  // Edit category/subcategory/level modal state
  const [editingCert, setEditingCert]     = useState(null);
  const [editCatId, setEditCatId]         = useState('');
  const [editSubcat, setEditSubcat]       = useState('');
  const [editLevel, setEditLevel]         = useState('');
  const [editPrize, setEditPrize]         = useState('');
  const [editSaving, setEditSaving]       = useState(false);

  const prizeLevels = ['Participation', 'First', 'Second', 'Third'];

  const fetchPending = async () => {
    setLoading(true);
    try {
      const [certRes, catRes] = await Promise.all([
        tutorAxios.get('/tutors/certificates/pending'),
        tutorAxios.get('/categories'),
      ]);
      setPendingCerts(certRes.data || []);
      setCategories(catRes.data.categories || []);
    } catch (err) {
      console.error('Error fetching pending certificates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const getPotentialPoints = (cert) => {
    if (!cert?.category) return 0;
    const sub = cert.category.subcategories?.find(
      s => s.name.toLowerCase() === cert.subcategory?.toLowerCase()
    );
    if (!sub) return 0;
    if (sub.fixedPoints != null) return sub.fixedPoints;
    if (sub.levels && cert.level && cert.prizeType) {
      const lvl   = sub.levels.find(l => l.name === cert.level);
      const prize = lvl?.prizes.find(p => p.type === cert.prizeType);
      return prize?.points ?? 0;
    }
    return 0;
  };

  // ── Approve ──
  const handleApprove = async (certId) => {
    if (!window.confirm('Approve this certificate?')) return;
    setProcessingId(certId);
    try {
      await tutorAxios.post(`/tutors/certificates/${certId}/approve`);
      await fetchPending();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve certificate');
    } finally {
      setProcessingId(null);
    }
  };

  // ── Reject modal ──
  const openRejectModal = (cert) => {
    setRejectingCert(cert);
    setRejectReason('');
    setRejectError('');
  };
  const closeRejectModal = () => {
    setRejectingCert(null);
    setRejectReason('');
    setRejectError('');
  };
  const submitReject = async () => {
    if (!rejectReason.trim()) {
      setRejectError('Please provide a reason for rejection so the student knows what to fix.');
      return;
    }
    setProcessingId(rejectingCert._id);
    closeRejectModal();
    try {
      await tutorAxios.post(`/tutors/certificates/${rejectingCert._id}/reject`, {
        reason: rejectReason.trim(),
      });
      await fetchPending();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reject certificate');
    } finally {
      setProcessingId(null);
    }
  };

  // ── Edit category/subcategory/level ──
  const openEditModal = (cert) => {
    setEditingCert(cert);
    setEditCatId(cert.category?._id || '');
    setEditSubcat(cert.subcategory || '');
    setEditLevel(cert.level || '');
    setEditPrize(cert.prizeType || '');
    setEditSaving(false);
  };
  const closeEditModal = () => {
    setEditingCert(null);
  };

  const editCategory = categories.find(c => c._id === editCatId);
  const editSubcats = editCategory?.subcategories || [];
  const editCurrentSub = editSubcats.find(s => s.name === editSubcat);
  const editHasLevels = editCurrentSub?.levels?.length > 0;

  const getEditPoints = () => {
    if (!editCurrentSub) return null;
    if (editCurrentSub.fixedPoints != null) return editCurrentSub.fixedPoints;
    if (editHasLevels && editLevel && editPrize) {
      const lvl = editCurrentSub.levels.find(l => l.name === editLevel);
      const prize = lvl?.prizes.find(p => p.type === editPrize);
      return prize?.points ?? null;
    }
    return null;
  };

  const submitEdit = async () => {
    if (!editCatId || !editSubcat) { alert('Please select category and subcategory'); return; }
    setEditSaving(true);
    try {
      await tutorAxios.patch(`/tutors/certificates/${editingCert._id}/reassign`, {
        categoryId: editCatId,
        subcategoryName: editSubcat,
        level: editLevel || '',
        prizeType: editPrize || '',
      });
      closeEditModal();
      await fetchPending();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update certificate. The backend may not support this yet.');
    } finally {
      setEditSaving(false);
    }
  };

  const openModal = (cert) => {
    const ext  = cert.fileUrl?.split('.').pop()?.split('?')[0] || 'jpg';
    const name = `${cert.student?.name || 'certificate'}_${cert.subcategory || ''}.${ext}`;
    setModalFile(name);
    setModalUrl(cert.fileUrl);
  };

  if (loading) return <p className="pending-loading"><Loader2 className="spinner"/> Loading pending certificates…</p>;
  if (!pendingCerts.length) return (
    <div className="pending-loading" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
      <Award size={48} style={{ color: '#22c55e', marginBottom: '0.5rem' }} />
      <p style={{ color: '#15803d', fontWeight: 600 }}>All caught up! No pending certificates.</p>
    </div>
  );

  return (
    <div className="pending-container">
      {/* Image/PDF viewer modal */}
      {modalUrl && (
        <CertModal
          url={modalUrl}
          fileName={modalFile}
          onClose={() => { setModalUrl(null); setModalFile(''); }}
        />
      )}

      {/* Reject reason modal */}
      {rejectingCert && (
        <div className="reject-overlay" onClick={e => { if (e.target === e.currentTarget) closeRejectModal(); }}>
          <div className="reject-modal">
            <div className="reject-modal-header">
              <div className="reject-modal-title">
                <AlertCircle size={20} className="reject-icon" />
                <span>Reject Certificate</span>
              </div>
              <button className="reject-close-btn" onClick={closeRejectModal}><X size={18}/></button>
            </div>
            <div className="reject-modal-body">
              <div className="reject-cert-info">
                <strong>{rejectingCert.student?.name}</strong>
                <span> — {rejectingCert.category?.name} / {rejectingCert.subcategory}</span>
              </div>
              <label className="reject-label">
                Reason for rejection <span className="reject-required">*</span>
                <span className="reject-hint">The student will see this message.</span>
              </label>
              <textarea
                className="reject-textarea"
                placeholder="e.g. Certificate image is blurry and unreadable. Please re-upload a clear scan."
                value={rejectReason}
                onChange={e => { setRejectReason(e.target.value); setRejectError(''); }}
                rows={4}
                autoFocus
              />
              {rejectError && <p className="reject-error"><AlertCircle size={13}/> {rejectError}</p>}
            </div>
            <div className="reject-modal-footer">
              <button className="reject-cancel-btn" onClick={closeRejectModal}>Cancel</button>
              <button className="reject-confirm-btn" onClick={submitReject}>Reject Certificate</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit category/subcategory/level modal */}
      {editingCert && (
        <div className="reject-overlay" onClick={e => { if (e.target === e.currentTarget) closeEditModal(); }}>
          <div className="reject-modal" style={{ maxWidth: 460 }}>
            <div className="reject-modal-header">
              <div className="reject-modal-title">
                <Edit2 size={18} className="reject-icon" style={{ color: '#2563eb' }} />
                <span>Reassign Certificate</span>
              </div>
              <button className="reject-close-btn" onClick={closeEditModal}><X size={18}/></button>
            </div>
            <div className="reject-modal-body">
              <div className="reject-cert-info" style={{ marginBottom: '1rem' }}>
                <strong>{editingCert.student?.name}</strong> — change category / subcategory / level
              </div>

              {/* Category */}
              <label className="reject-label">Category</label>
              <select
                className="reject-textarea"
                style={{ fontFamily: 'inherit', fontSize: '14px', padding: '8px', borderRadius: '8px', border: '1.5px solid #cbd5e1', resize: 'none' }}
                value={editCatId}
                onChange={e => { setEditCatId(e.target.value); setEditSubcat(''); setEditLevel(''); setEditPrize(''); }}
              >
                <option value="">Select category</option>
                {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>

              {/* Subcategory */}
              {editSubcats.length > 0 && (
                <>
                  <label className="reject-label" style={{ marginTop: '0.75rem' }}>Subcategory</label>
                  <select
                    className="reject-textarea"
                    style={{ fontFamily: 'inherit', fontSize: '14px', padding: '8px', borderRadius: '8px', border: '1.5px solid #cbd5e1', resize: 'none' }}
                    value={editSubcat}
                    onChange={e => { setEditSubcat(e.target.value); setEditLevel(''); setEditPrize(''); }}
                  >
                    <option value="">Select subcategory</option>
                    {editSubcats.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </>
              )}

              {/* Points reference table — shows every level/prize combo's points as soon as a subcategory with levels is picked, so the tutor can see what's obtainable before choosing */}
              {editHasLevels && (
                <div style={{ marginTop: '0.75rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ padding: '6px 10px', background: '#f8fafc', fontSize: '12px', fontWeight: 700, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                    Points obtainable for "{editSubcat}"
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ textAlign: 'left', padding: '6px 10px', color: '#64748b', fontWeight: 600 }}>Level</th>
                        {prizeLevels.map(p => (
                          <th key={p} style={{ textAlign: 'center', padding: '6px 8px', color: '#64748b', fontWeight: 600 }}>{p}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {editCurrentSub.levels.map(l => (
                        <tr key={l.name} style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 600, color: '#334155' }}>{l.name}</td>
                          {prizeLevels.map(p => {
                            const prize = l.prizes.find(pr => pr.type === p);
                            const isSelected = editLevel === l.name && editPrize === p;
                            return (
                              <td
                                key={p}
                                style={{
                                  textAlign: 'center',
                                  padding: '6px 8px',
                                  color: prize ? '#0f172a' : '#cbd5e1',
                                  background: isSelected ? '#dbeafe' : 'transparent',
                                  fontWeight: isSelected ? 700 : 400,
                                  borderRadius: isSelected ? '6px' : 0,
                                }}
                              >
                                {prize ? prize.points : '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Level */}
              {editHasLevels && (
                <>
                  <label className="reject-label" style={{ marginTop: '0.75rem' }}>Level</label>
                  <select
                    className="reject-textarea"
                    style={{ fontFamily: 'inherit', fontSize: '14px', padding: '8px', borderRadius: '8px', border: '1.5px solid #cbd5e1', resize: 'none' }}
                    value={editLevel}
                    onChange={e => { setEditLevel(e.target.value); setEditPrize(''); }}
                  >
                    <option value="">Select Level</option>
                    {editCurrentSub.levels.map(l => <option key={l.name} value={l.name}>{l.name}</option>)}
                  </select>

                  <label className="reject-label" style={{ marginTop: '0.75rem' }}>Prize Type</label>
                  <select
                    className="reject-textarea"
                    style={{ fontFamily: 'inherit', fontSize: '14px', padding: '8px', borderRadius: '8px', border: '1.5px solid #cbd5e1', resize: 'none' }}
                    value={editPrize}
                    onChange={e => setEditPrize(e.target.value)}
                  >
                    <option value="">Select Prize</option>
                    {prizeLevels.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </>
              )}

              {getEditPoints() !== null && (
                <div style={{ marginTop: '0.75rem', padding: '8px 12px', background: '#ecfeff', borderRadius: '8px', fontSize: '14px', color: '#0c4a6e', fontWeight: 600 }}>
                  <Award size={14} style={{ display: 'inline', marginRight: 6 }} />
                  Points after reassign: {getEditPoints()}
                </div>
              )}
            </div>
            <div className="reject-modal-footer">
              <button className="reject-cancel-btn" onClick={closeEditModal}>Cancel</button>
              <button
                className="reject-confirm-btn"
                style={{ background: '#2563eb' }}
                onClick={submitEdit}
                disabled={editSaving}
              >
                {editSaving ? <><Loader2 size={14} className="spinner"/> Saving…</> : <><Check size={14}/> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Certificate cards */}
      {pendingCerts.map(cert => {
        const isProcessing = processingId === cert._id;
        const points       = getPotentialPoints(cert);

        return (
          <div key={cert._id} className="pending-card">
            <div className="card-left">
              <h3 className="student-name">{cert.student?.name || 'N/A'}</h3>
              <p className="reg-no">{cert.student?.registerNumber}</p>

              <p><strong>Category:</strong> {cert.category?.name || 'N/A'}</p>
              <p><strong>Subcategory:</strong> {cert.subcategory || 'N/A'}</p>

              {cert.eventName && (
                <p><strong>Event / Competition:</strong> {cert.eventName}</p>
              )}

              {(cert.level || cert.prizeType) && (
                <p className="level-info">
                  <Award size={14}/>
                  {cert.level ?? ''}{cert.level && cert.prizeType ? ' · ' : ''}{cert.prizeType ?? ''}
                </p>
              )}

              {/* Duration / Date range */}
              {(cert.dateFrom || cert.dateTo) && (
                <p style={{ fontSize: '0.82rem', color: '#475569', marginTop: '0.2rem' }}>
                  <strong>Duration:</strong>{' '}
                  {cert.dateFrom ? new Date(cert.dateFrom).toLocaleDateString('en-IN') : '—'}
                  {cert.dateTo && cert.dateTo !== cert.dateFrom
                    ? ` → ${new Date(cert.dateTo).toLocaleDateString('en-IN')}`
                    : ''}
                </p>
              )}

              <p className="points"><strong>Points:</strong> {points} pts</p>

              <div className="cert-file-actions">
                <button className="view-link" onClick={() => openModal(cert)}>
                  <Eye size={14}/> View Certificate
                </button>
                <button
                  className="view-link"
                  style={{ color: '#2563eb', marginLeft: '0.5rem' }}
                  onClick={() => openEditModal(cert)}
                >
                  <Edit2 size={14}/> Edit Assignment
                </button>
              </div>
            </div>

            <div className="card-right">
              <button
                className="btn-approve"
                onClick={() => handleApprove(cert._id)}
                disabled={isProcessing}
              >
                {isProcessing
                  ? <><Loader2 size={14} className="spinner"/> Processing…</>
                  : 'Approve'
                }
              </button>
              <button
                className="btn-reject"
                onClick={() => openRejectModal(cert)}
                disabled={isProcessing}
              >
                {isProcessing
                  ? <><Loader2 size={14} className="spinner"/> Processing…</>
                  : 'Reject'
                }
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PendingCertificates;
