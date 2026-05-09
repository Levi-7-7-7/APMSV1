import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import tutorAxios from '../api/tutorAxios';
import { Download, Search, Trash2, Eye, Users, Loader2, ArrowUpDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import '../css/StudentList.css';
import logo from '../assets/mti-logo.png';
import { calcCappedPoints, passThreshold } from '../utils/calcPoints';

// Alias so existing code using PASS_THRESHOLD(isLateral) still works
const PASS_THRESHOLD = (isLateral) => passThreshold(isLateral);
// Alias so PDF export using calcCappedTotal(certs, isLateral) still works
// The backend already pre-calculates totalPoints correctly — this is only used in PDF export
const calcCappedTotal = (approvedCerts, isLateralEntry) =>
  calcCappedPoints(approvedCerts, [], isLateralEntry);

// ─── Component ───────────────────────────────────────────────────────────────
const StudentList = () => {
  const navigate = useNavigate();

  const [students,      setStudents]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [batchFilter,   setBatchFilter]   = useState('');
  const [branchFilter,  setBranchFilter]  = useState('');
  const [search,        setSearch]        = useState('');
  const [regSearch,     setRegSearch]     = useState('');
  const [batchOptions,  setBatchOptions]  = useState([]);
  const [branchOptions, setBranchOptions] = useState([]);
  const [deleting,      setDeleting]      = useState(null);
  const [msg,           setMsg]           = useState('');
  const [pdfLoading,    setPdfLoading]    = useState(false);
  const [sortBy,        setSortBy]        = useState('regNo'); // 'regNo' | 'name' | 'points'

  const tutorBatch  = JSON.parse(localStorage.getItem('tutorBatch')  || 'null');
  const tutorBranch = JSON.parse(localStorage.getItem('tutorBranch') || 'null');

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res  = await tutorAxios.get('/tutors/students');
      const list = res.data.students || [];
      setStudents(list);
      setBatchOptions([...new Set(list.map(s => s.batch?.name).filter(Boolean))]);
      setBranchOptions([...new Set(list.map(s => s.branch?.name).filter(Boolean))]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStudents(); }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete student "${name}"? This will also remove all their certificates.`)) return;
    setDeleting(id);
    try {
      await tutorAxios.delete(`/tutors/students/${id}`);
      setStudents(prev => prev.filter(s => s._id !== id));
      setMsg(`Student "${name}" deleted.`);
      setTimeout(() => setMsg(''), 3500);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete student');
    } finally {
      setDeleting(null);
    }
  };

  const filtered = students.filter(s => {
    const nameOk   = search       ? s.name?.toLowerCase().includes(search.toLowerCase()) : true;
    const regOk    = regSearch    ? s.registerNumber?.toLowerCase().includes(regSearch.toLowerCase()) : true;
    const batchOk  = batchFilter  ? s.batch?.name  === batchFilter  : true;
    const branchOk = branchFilter ? s.branch?.name === branchFilter : true;
    return nameOk && regOk && batchOk && branchOk;
  }).slice().sort((a, b) => {
    if (sortBy === 'name')   return (a.name || '').localeCompare(b.name || '');
    if (sortBy === 'points') return (b.totalPoints || 0) - (a.totalPoints || 0);
    // default: register number
    return (a.registerNumber || '').localeCompare(b.registerNumber || '', undefined, { numeric: true });
  });

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filtered.map(s => ({
        Name:           s.name,
        RegisterNumber: s.registerNumber,
        Batch:          s.batch?.name,
        Branch:         s.branch?.name,
        Email:          s.email,
        TotalPoints:    s.totalPoints || 0,
        Type:           s.isLateralEntry ? 'Lateral Entry' : 'Regular',
        Status:         (s.totalPoints || 0) >= PASS_THRESHOLD(s.isLateralEntry) ? 'PASS' : 'FAIL',
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'students_list.xlsx');
  };

  // ── PDF Export (detailed, student-wise) ─────────────────────────────────────
  const exportPDF = async () => {
    setPdfLoading(true);
    try {
      // Fetch all certs for this tutor's scope
      const certRes  = await tutorAxios.get('/tutors/certificates');
      const allCerts = certRes.data.certificates || [];

      // Map: studentId -> certs[]
      const certsByStudent = {};
      allCerts.forEach(cert => {
        const sid = cert.student?._id || cert.student;
        if (!certsByStudent[sid]) certsByStudent[sid] = [];
        certsByStudent[sid].push(cert);
      });

      const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const mL = 12;
      const mR = 12;
      const mT = 10;

      // Draw full page header (only on page 1) — returns bottom Y of header
      const drawHeader = () => {
      try {
        doc.addImage(logo, 'PNG', mL, mT - 2, 30, 30);
      } catch (_) {}

      const textCX = pageW / 2 + 8;

      // Department
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 40, 100);

      const deptName = tutorBranch?.name
        ? `DEPARTMENT OF ${tutorBranch.name.toUpperCase()}`
        : 'DEPARTMENT OF COMPUTER ENGINEERING';

      doc.text(deptName, textCX, mT + 4, { align: 'center' });

      // College Name
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);

      doc.text(
        "MAHARAJA'S TECHNOLOGICAL INSTITUTE (MTI)",
        textCX,
        mT + 10,
        { align: 'center' }
      );

      // Address Details
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);

      doc.text(
        'Chembukkavu, Thrissur, Kerala – 680020',
        textCX,
        mT + 15,
        { align: 'center' }
      );

      doc.text(
        'Affiliated to SBTE Kerala | AICTE Approved | Est. 1946',
        textCX,
        mT + 20,
        { align: 'center' }
      );

      doc.text(
        'Phone: 0487-2333290 | E-Mail: mtithrsr@mtithrissur.ac.in',
        textCX,
        mT + 25,
        { align: 'center' }
      );

      // Bottom line
      doc.setDrawColor(15, 40, 100);
      doc.setLineWidth(0.7);
      doc.line(mL, mT + 29, pageW - mR, mT + 29);

      return mT + 29;
    };

      // Draw blue title banner — returns bottom Y
      const drawTitleBand = (y) => {
        doc.setFillColor(15, 40, 100);
        doc.rect(mL, y + 1, pageW - mL - mR, 9, 'F');
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        const batchLabel = tutorBatch?.name ? ` — BATCH ${tutorBatch.name}` : '';
        doc.text(
          `STUDENT ACTIVITY POINTS REPORT${batchLabel}`,
          pageW / 2, y + 7, { align: 'center' }
        );
        doc.setTextColor(0, 0, 0);
        return y + 11;
      };

      

      // Footer — added after all pages are done
      const addFooters = () => {
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setDrawColor(190, 190, 190);
          doc.setLineWidth(0.3);
          doc.line(mL, pageH - 10, pageW - mR, pageH - 10);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(130);
          doc.text(
            `Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
            mL, pageH - 6
          );
          doc.text(`Page ${i} of ${totalPages}`, pageW - mR, pageH - 6, { align: 'right' });
        }
      };

      // First page
      let curY = drawHeader();
      curY = drawTitleBand(curY);
      curY += 4;

      // Summary line
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(70);
      doc.text(
        `Total Students: ${filtered.length}  |  Lateral Entry: ${filtered.filter(s => s.isLateralEntry).length}  |  Regular: ${filtered.filter(s => !s.isLateralEntry).length}`,
        pageW / 2, curY, { align: 'center' }
      );
      curY += 4;

      doc.setDrawColor(200);
      doc.setLineWidth(0.3);
      doc.line(mL, curY, pageW - mR, curY);
      curY += 4;

      // ── Per-student sections ────────────────────────────────────────────────
      filtered.forEach((student, idx) => {
        const studentCerts  = certsByStudent[student._id] || [];
        const approvedCerts = studentCerts.filter(c => c.status === 'approved');
        const computedTotal = calcCappedTotal(approvedCerts, student.isLateralEntry);
        const threshold     = PASS_THRESHOLD(student.isLateralEntry);
        const isPassing     = computedTotal >= threshold;

        // Rough height check — page break if needed
        const estH = 38 + Math.max(approvedCerts.length, 1) * 8;
        if (curY + estH > pageH - 14 && idx > 0) {
          doc.addPage();         
          curY = 18;
        }

        // ── Student info card ─────────────────────────────────────────────────
        doc.setFillColor(242, 246, 255);
        doc.roundedRect(mL, curY, pageW - mL - mR, 28, 2, 2, 'F');
        doc.setDrawColor(185, 205, 245);
        doc.setLineWidth(0.4);
        doc.roundedRect(mL, curY, pageW - mL - mR, 28, 2, 2, 'S');

        // Left accent bar
        doc.setFillColor(15, 40, 100);
        doc.rect(mL, curY, 3, 28, 'F');

        // Index circle
        doc.setFillColor(15, 40, 100);
        doc.circle(mL + 11, curY + 8.5, 5.5, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255);
        doc.text(String(idx + 1), mL + 11, curY + 11, { align: 'center' });

        const tx = mL + 20;

        // Name
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(10, 30, 90);
        doc.text(student.name || '—', tx, curY + 8);

        // Reg No
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(70);
        doc.text(`Reg No: ${student.registerNumber || '—'}`, tx, curY + 14);

        // Branch | Batch
        doc.text(
          `Branch: ${student.branch?.name || '—'}   |   Batch: ${student.batch?.name || '—'}`,
          tx, curY + 19.5
        );

        // Email
        doc.text(`Email: ${student.email || '—'}`, tx, curY + 25);

        // Right side — points + status
        const rX = pageW - mR - 6;

        // Student type tag
        doc.setFontSize(6);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...(student.isLateralEntry ? [130, 90, 0] : [100, 100, 100]));
        doc.text(
          student.isLateralEntry ? 'Lateral Entry (needs 40 pts)' : 'Regular (needs 60 pts)',
          rX - 18, curY + 5, { align: 'right' }
        );

        // Points big number
        doc.setFontSize(19);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...(isPassing ? [21, 128, 61] : [185, 28, 28]));
        doc.text(String(computedTotal), rX - 19, curY + 15, { align: 'right' });

        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(110);
        doc.text('pts', rX - 19, curY + 19, { align: 'right' });

        // PASS / FAIL badge
        const bW = 19; const bH = 7.5;
        const bX = rX - bW; const bY = curY + 20.5;
        doc.setFillColor(...(isPassing ? [220, 252, 231] : [254, 226, 226]));
        doc.roundedRect(bX, bY, bW, bH, 2, 2, 'F');
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...(isPassing ? [21, 128, 61] : [185, 28, 28]));
        doc.text(isPassing ? 'PASS' : 'FAIL', bX + bW / 2, bY + 5.2, { align: 'center' });

        curY += 30;

        // ── Cert table (approved only) ─────────────────────────────────────────
        if (approvedCerts.length === 0) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(160);
          doc.text('No approved certificates.', mL + 6, curY + 5);
          curY += 10;
        } else {
          autoTable(doc, {
            startY: curY,
            margin: { left: mL, right: mR },
            head: [['#', 'Event / Certificate Title', 'Category', 'Subcategory', 'Level', 'Prize', 'Pts Awarded', 'Date']],
            body: approvedCerts.map((cert, ci) => {
              const certDate = cert.dateFrom
                ? new Date(cert.dateFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                : cert.createdAt
                  ? new Date(cert.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                  : '—';

              const displayTitle = cert.eventName
                ? cert.eventName
                : cert.subcategory || '—';

              const pts = cert.pointsAwarded ?? 0;

              return [
                ci + 1,
                displayTitle,
                cert.category?.name || '—',
                cert.subcategory || '—',
                cert.level || '—',
                cert.prizeType || '—',
                pts,
                certDate,
              ];
            }),

            styles: { fontSize: 7, cellPadding: 2.2, valign: 'middle', overflow: 'linebreak' },
            headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 7 },
            columnStyles: {
              0: { halign: 'center', cellWidth: 7 },
              1: { cellWidth: 46 },
              2: { cellWidth: 30 },
              3: { cellWidth: 28 },
              4: { cellWidth: 18 },
              5: { cellWidth: 18 },
              6: { halign: 'center', cellWidth: 13 },
              7: { halign: 'center', cellWidth: 18 },
            },
            didParseCell: data => {
              if (data.section === 'body' && data.row.index % 2 === 0) {
                data.cell.styles.fillColor = [245, 249, 255];
              }
            },
          });

          curY = doc.lastAutoTable.finalY + 4;
        }

        // Divider between students
        doc.setDrawColor(210, 220, 245);
        doc.setLineWidth(0.25);
        doc.line(mL, curY, pageW - mR, curY);
        curY += 5;
      });

      addFooters();

      const branchSlug = (tutorBranch?.name || 'dept').replace(/\s+/g, '_').toLowerCase();
      doc.save(`activity_points_${branchSlug}_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="student-list-card">
      {/* Header */}
      <div className="sl-header">
        <div className="sl-title-row">
          <Users size={22} />
          <h2>Student List</h2>
          <span className="sl-count">{filtered.length} students</span>
        </div>

        {(tutorBatch || tutorBranch) && (
          <div className="sl-scope-badge">
            {tutorBatch  && <span>Batch: <strong>{tutorBatch.name}</strong></span>}
            {tutorBranch && <span>Branch: <strong>{tutorBranch.name}</strong></span>}
          </div>
        )}
      </div>

      {msg && <div className="sl-msg">{msg}</div>}

      {/* Filters */}
      <div className="sl-filters">
        <div className="sl-search-group">
          <Search size={15} className="sl-search-icon" />
          <input
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="sl-input"
          />
        </div>

        <div className="sl-search-group">
          <Search size={15} className="sl-search-icon" />
          <input
            type="text"
            placeholder="Search by reg. no…"
            value={regSearch}
            onChange={e => setRegSearch(e.target.value)}
            className="sl-input"
          />
        </div>

        <select className="sl-select" value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
          <option value="">All Batches</option>
          {batchOptions.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <select className="sl-select" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
          <option value="">All Branches</option>
          {branchOptions.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <div className="sl-sort-group">
          <ArrowUpDown size={14} className="sl-sort-icon" />
          <select
            className="sl-select sl-sort-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            title="Sort students"
          >
            <option value="regNo">Sort: Reg. No.</option>
            <option value="name">Sort: Name (A–Z)</option>
            <option value="points">Sort: Highest Points</option>
          </select>
        </div>

        <div className="sl-actions">
          <button className="sl-btn outline" onClick={exportExcel} title="Export Excel">
            <Download size={15} /> Excel
          </button>

          <button
            className="sl-btn outline"
            onClick={exportPDF}
            disabled={pdfLoading}
            title="Export detailed PDF report"
          >
            {pdfLoading
              ? <><Loader2 size={15} className="sl-spin" /> Generating…</>
              : <><Download size={15} /> PDF</>}
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="sl-loading">Loading students…</div>
      ) : filtered.length === 0 ? (
        <div className="sl-empty">No students found.</div>
      ) : (
        <div className="sl-table-wrap">
          <table className="sl-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Reg No</th>
                <th>Batch</th>
                <th>Branch</th>
                <th>Email</th>
                <th>Points</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, idx) => (
                <tr key={s._id}>
                  <td className="sl-rank">{idx + 1}</td>
                  <td className="sl-name">{s.name}</td>
                  <td className="sl-mono">{s.registerNumber}</td>
                  <td>{s.batch?.name || '—'}</td>
                  <td>{s.branch?.name || '—'}</td>
                  <td className="sl-email">{s.email}</td>
                  <td>
                    <span
                      className={`sl-pts ${
                        (s.totalPoints || 0) >= PASS_THRESHOLD(s.isLateralEntry)
                          ? 'pass'
                          : (s.totalPoints || 0) >= PASS_THRESHOLD(s.isLateralEntry) / 2
                          ? 'mid'
                          : ''
                      }`}
                      title={s.isLateralEntry ? 'Lateral Entry (needs 40 pts, max 30 per category)' : 'Regular (needs 60 pts, max 40 per category)'}
                    >
                      {s.totalPoints || 0}
                      {s.isLateralEntry ? ' ✦' : ''}
                    </span>
                  </td>
                  <td className="sl-action-cell">
                    <button
                      className="sl-btn primary sm"
                      onClick={() => navigate(`/tutor/dashboard/students/${s._id}`)}
                      title="View details"
                    >
                      <Eye size={13} /> View
                    </button>
                    <button
                      className="sl-btn danger sm"
                      onClick={() => handleDelete(s._id, s.name)}
                      disabled={deleting === s._id}
                      title="Delete student"
                    >
                      <Trash2 size={13} /> {deleting === s._id ? '…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {students.some(s => s.isLateralEntry) && (
        <div className="sl-legend">
          <span className="sl-pts mid">✦</span> = Lateral Entry student (requires 40 pts instead of 60; max 30 pts per segment instead of 40)
        </div>
      )}
    </div>
  );
};

export default StudentList;
