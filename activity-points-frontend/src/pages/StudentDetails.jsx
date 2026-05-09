import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import tutorAxios from '../api/tutorAxios';
import { Loader2, Award, Info, ArrowLeft, Eye, CheckCircle, XCircle } from 'lucide-react';
import CertModal from '../components/CertModal';
import '../css/StudentDetails.css';

const StudentDetails = () => {
  const { studentId } = useParams();
  const navigate      = useNavigate();

  const [certificates, setCertificates] = useState([]);
  const [categories, setCategories]     = useState([]);
  const [studentInfo, setStudentInfo]   = useState(null); // full student record from tutor/students
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState('all');
  const [modalUrl, setModalUrl]         = useState(null);
  const [modalFile, setModalFile]       = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [certRes, catRes, studentsRes] = await Promise.all([
          tutorAxios.get('/tutors/certificates'),
          tutorAxios.get('/categories'),
          tutorAxios.get('/tutors/students'),
        ]);

        const allCerts     = certRes.data.certificates || [];
        const studentCerts = allCerts.filter(
          c => (c.student?._id || c.student) === studentId
        );
        setCertificates(studentCerts);
        setCategories(catRes.data.categories || []);

        // Get full student info (includes isLateralEntry)
        const found = (studentsRes.data.students || []).find(s => s._id === studentId);
        setStudentInfo(found || null);
      } catch (err) {
        console.error('Error fetching student details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [studentId]);

  const pointsSummary = useMemo(() => {
    const approvedCerts = certificates.filter(c => c.status?.toLowerCase() === 'approved');
    const rawTotal = approvedCerts.reduce((s, c) => s + (c.pointsAwarded || 0), 0);

    const grouped = approvedCerts.reduce((acc, cert) => {
      const catId = cert.category?._id || cert.category;
      if (!acc[catId]) acc[catId] = [];
      acc[catId].push(cert);
      return acc;
    }, {});

    let cappedTotal = 0;
    Object.keys(grouped).forEach(catId => {
      const catData    = categories.find(c => c._id === catId);
      if (!catData) return;
      const certsInCat = grouped[catId];
      const catName    = catData.name.toLowerCase();
      const catSum     = (catName.includes('arts') || catName.includes('sports'))
        ? Math.max(...certsInCat.map(c => c.pointsAwarded || 0), 0)
        : certsInCat.reduce((s, c) => s + (c.pointsAwarded || 0), 0);
      cappedTotal += Math.min(catSum, catData.maxPoints || 40);
    });

    return { rawTotal, cappedTotal };
  }, [certificates, categories]);

  // Lateral entry students need 40 pts, regular students need 60 pts
  const isLateralEntry = studentInfo?.isLateralEntry ?? false;
  const requiredPoints = isLateralEntry ? 40 : 60;
  const hasPassed      = pointsSummary.cappedTotal >= requiredPoints;

  const filteredCerts = filter === 'all'
    ? certificates
    : certificates.filter(c => c.status?.toLowerCase() === filter);

  // Use studentInfo for name/reg (more reliable than cert.student)
  const studentName = studentInfo?.name || certificates[0]?.student?.name || '—';
  const studentReg  = studentInfo?.registerNumber || certificates[0]?.student?.registerNumber || '';
  const studentEmail= studentInfo?.email || certificates[0]?.student?.email || '';

  const displayPoints = (cert) => {
    if (cert.status?.toLowerCase() === 'approved') return cert.pointsAwarded ?? 0;
    const sub = cert.category?.subcategories?.find(
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

  const openModal = (cert) => {
    const ext  = cert.fileUrl?.split('.').pop()?.split('?')[0] || 'jpg';
    const name = `${studentName}_${cert.subcategory || 'cert'}.${ext}`;
    setModalFile(name);
    setModalUrl(cert.fileUrl);
  };

  return (
    <div className="student-details-container">
      {modalUrl && (
        <CertModal
          url={modalUrl}
          fileName={modalFile}
          onClose={() => { setModalUrl(null); setModalFile(''); }}
        />
      )}

      <button className="back-btn" onClick={() => navigate('/tutor/dashboard/students')}>
        <ArrowLeft size={18}/> Back to Students
      </button>

      {loading ? (
        <div className="loading-state">
          <Loader2 className="spinner"/>
          <p>Loading student records…</p>
        </div>
      ) : (
        <>
          {/* ── Profile card ── */}
          <header className="student-profile-card">
            <div className="profile-main">
              <div className="avatar-circle">{studentName.charAt(0)}</div>
              <div className="profile-info">
                <h2>{studentName}</h2>
                <p className="reg-no">{studentReg}</p>
                <p className="email-text">{studentEmail}</p>
                {isLateralEntry && (
                  <span className="lateral-badge">Lateral Entry</span>
                )}
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-box raw">
                <span className="stat-label">Raw Total</span>
                <span className="stat-value">{pointsSummary.rawTotal}</span>
              </div>
              <div className="stat-box capped">
                <span className="stat-label">
                  Capped Total <Info size={14} className="info-icon"/>
                </span>
                <span className="stat-value">{pointsSummary.cappedTotal}</span>
              </div>
              {/* Lateral-entry-aware pass/fail indicator */}
              <div className={`stat-box ${hasPassed ? 'pass' : 'fail'}`}>
                <span className="stat-label">
                  Status <span className="req-pts">({requiredPoints} pts req.)</span>
                </span>
                <span className="stat-value status-val">
                  {hasPassed
                    ? <><CheckCircle size={18}/> Pass</>
                    : <><XCircle size={18}/> {requiredPoints - pointsSummary.cappedTotal} pts left</>
                  }
                </span>
              </div>
            </div>
          </header>

          {/* ── Certificates ── */}
          <section className="certificates-section">
            <div className="section-header">
              <h3>Certificates ({filteredCerts.length})</h3>
              <div className="filter-pills">
                {['all', 'pending', 'approved', 'rejected'].map(s => (
                  <button key={s} onClick={() => setFilter(s)}
                    className={`pill ${filter === s ? 'active' : ''}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {!filteredCerts.length ? (
              <div className="empty-placeholder">
                <Award size={48}/>
                <p>No {filter !== 'all' ? filter : ''} certificates found.</p>
              </div>
            ) : (
              <div className="cert-grid">
                {filteredCerts.map(cert => (
                  <div key={cert._id} className={`cert-card border-${cert.status}`}>
                    <div className="cert-top">
                      <span className={`status-indicator ${cert.status}`}>{cert.status}</span>
                      <h4 className="truncate">{cert.category?.name}</h4>
                    </div>
                    <div className="cert-body">
                      <p className="subcat"><strong>Subcategory:</strong> {cert.subcategory}</p>
                      {(cert.level || cert.prizeType) && (
                        <p className="subcat" style={{ color: '#64748b', fontSize: '0.8rem' }}>
                          {cert.level}{cert.level && cert.prizeType ? ' · ' : ''}{cert.prizeType}
                        </p>
                      )}
                      <div className="points-badge">{displayPoints(cert)} pts</div>
                    </div>

                    {/* Show rejection reason if rejected */}
                    {cert.status?.toLowerCase() === 'rejected' && cert.rejectionReason && (
                      <div className="cert-rejection-reason">
                        <XCircle size={13} style={{ flexShrink: 0 }}/>
                        <span><strong>Rejected:</strong> {cert.rejectionReason}</span>
                      </div>
                    )}

                    <div className="cert-footer">
                      <button className="view-doc" onClick={() => openModal(cert)}>
                        <Eye size={13}/> View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default StudentDetails;
