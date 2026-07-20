import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Award, Eye, RotateCcw, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
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

  // Which student's approved certificates are currently open. null = show
  // the student list (grouped, same chat-list style as Pending Certificates)
  // instead of every single certificate card flattened out.
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  const fetchApproved = () => {
    setLoading(true);
    return tutorAxios.get('/tutors/certificates')
      .then(res => {
        const approved = (res.data.certificates || []).filter(c => c.status === 'approved');
        setCertificates(approved);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchApproved(); }, []);

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

  // Group into per-student queues, same pattern as Pending Certificates.
  // Within each student, most-recently-approved cert first. Students
  // themselves are ordered by their most recent approval — whoever's
  // certificate was approved most recently surfaces at the top.
  const studentGroups = useMemo(() => {
    const byId = new Map();
    for (const cert of filtered) {
      const sid = cert.student?._id || cert.student;
      if (!sid) continue;
      if (!byId.has(sid)) byId.set(sid, { student: cert.student, certs: [] });
      byId.get(sid).certs.push(cert);
    }
    const groups = Array.from(byId.values());
    for (const g of groups) {
      g.certs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
    groups.sort((a, b) => new Date(b.certs[0]?.updatedAt) - new Date(a.certs[0]?.updatedAt));
    return groups;
  }, [filtered]);

  const selectedGroup = selectedStudentId
    ? studentGroups.find(g => (g.student?._id || g.student) === selectedStudentId)
    : null;

  // If the student currently open no longer has any approved certificates
  // (e.g. the tutor just reverted their last one), automatically drop back
  // to the student list instead of showing an empty detail view.
  useEffect(() => {
    if (selectedStudentId && !loading && !selectedGroup) {
      setSelectedStudentId(null);
    }
  }, [selectedStudentId, selectedGroup, loading]);

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

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
      ) : !selectedGroup ? (
        /* ── Student list (default view) ── */
        <div className="approved-student-list">
          {studentGroups.map(group => {
            const sid = group.student?._id || group.student;
            const latest = group.certs[0];
            const initials = (group.student?.name || '?')
              .split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

            return (
              <button
                key={sid}
                type="button"
                className="approved-student-row"
                onClick={() => setSelectedStudentId(sid)}
              >
                <span className="approved-student-avatar">{initials}</span>

                <span className="approved-student-info">
                  <span className="approved-student-name">{group.student?.name || 'N/A'}</span>
                  <span className="approved-student-reg">{group.student?.registerNumber}</span>
                  <span className="approved-student-preview">
                    <CheckCircle2 size={12} />
                    Approved {timeAgo(latest?.updatedAt)} · {latest?.category?.name || latest?.subcategory || 'Certificate'}
                  </span>
                </span>

                <span className="approved-student-meta">
                  <span className="approved-student-badge">{group.certs.length}</span>
                  <ChevronRight size={18} className="approved-student-chevron" />
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        /* ── Detail view: one student's approved certificates ── */
        <div className="approved-detail">
          <button type="button" className="approved-back-btn" onClick={() => setSelectedStudentId(null)}>
            <ChevronLeft size={18} /> All students
          </button>

          <div className="approved-detail-header">
            <span className="approved-student-avatar lg">
              {(selectedGroup.student?.name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </span>
            <div>
              <h3 className="approved-detail-name">{selectedGroup.student?.name || 'N/A'}</h3>
              <p className="approved-detail-reg">
                {selectedGroup.student?.registerNumber} · {selectedGroup.certs.length} approved certificate{selectedGroup.certs.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="approved-list">
            {selectedGroup.certs.map(cert => (
              <div key={cert._id} className="approved-card">
                <div className="approved-card-top">
                  <div>
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
        </div>
      )}
    </div>
  );
}
