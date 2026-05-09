import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import tutorAxios from '../api/tutorAxios';
import { Download, Search, Trash2, Eye, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import '../css/StudentList.css';
import logo from '../assets/mti-logo.png';

const StudentList = () => {
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [batchFilter, setBatchFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [search, setSearch] = useState('');
  const [regSearch, setRegSearch] = useState('');
  const [batchOptions, setBatchOptions] = useState([]);
  const [branchOptions, setBranchOptions] = useState([]);
  const [deleting, setDeleting] = useState(null);
  const [msg, setMsg] = useState('');

  // Read assigned batch/branch from localStorage
  const tutorBatch = JSON.parse(localStorage.getItem('tutorBatch') || 'null');
  const tutorBranch = JSON.parse(localStorage.getItem('tutorBranch') || 'null');

  const fetchStudents = async () => {
    setLoading(true);

    try {
      const res = await tutorAxios.get('/tutors/students');
      const list = res.data.students || [];

      setStudents(list);

      setBatchOptions([
        ...new Set(list.map(s => s.batch?.name).filter(Boolean)),
      ]);

      setBranchOptions([
        ...new Set(list.map(s => s.branch?.name).filter(Boolean)),
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleDelete = async (id, name) => {
    if (
      !window.confirm(
        `Delete student "${name}"? This will also remove all their certificates.`
      )
    )
      return;

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
    const nameOk = search
      ? s.name?.toLowerCase().includes(search.toLowerCase())
      : true;

    const regOk = regSearch
      ? s.registerNumber
          ?.toLowerCase()
          .includes(regSearch.toLowerCase())
      : true;

    const batchOk = batchFilter
      ? s.batch?.name === batchFilter
      : true;

    const branchOk = branchFilter
      ? s.branch?.name === branchFilter
      : true;

    return nameOk && regOk && batchOk && branchOk;
  });

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filtered.map(s => ({
        Name: s.name,
        RegisterNumber: s.registerNumber,
        Batch: s.batch?.name,
        Branch: s.branch?.name,
        Email: s.email,
        TotalPoints: s.totalPoints || 0,
      }))
    );

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, 'Students');

    XLSX.writeFile(wb, 'students_list.xlsx');
  };

  const exportPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageW = doc.internal.pageSize.getWidth();

    // ── Logo ──
    let headerStartY = 12;

    try {
      doc.addImage(logo, 'PNG', 10, 4, 30, 30);
    } catch (_) {}

    // ── Header ──
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);

    const departmentName = tutorBranch?.name
      ? `DEPARTMENT OF ${tutorBranch.name.toUpperCase()}`
      : 'DEPARTMENT OF ELECTRONICS ENGINEERING';

    doc.text(
      departmentName,
      pageW / 2,
      headerStartY,
      { align: 'center' }
    );

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');

    doc.text(
      "MAHARAJA'S TECHNOLOGICAL INSTITUTE (MTI), THRISSUR",
      pageW / 2,
      headerStartY + 6,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    doc.text(
      'Affiliated to State Board of Technical Education, Kerala',
      pageW / 2,
      headerStartY + 11,
      { align: 'center' }
    );

    doc.text(
      'Approved by All India Council For Technical Education (AICTE) | Established in 1946',
      pageW / 2,
      headerStartY + 16,
      { align: 'center' }
    );

    doc.text(
      'Chembukkavu, Thrissur, Kerala – 680020, Phone: 0487-2333290, E-Mail: mtithrsr@mtithrissur.ac.in',
      pageW / 2,
      headerStartY + 21,
      { align: 'center' }
    );

    // ── Dividers ──
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);

    const divY = headerStartY + 24;

    doc.line(10, divY, pageW - 10, divY);

    // ── Sub-header ──
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');

    const branchLabel =
      tutorBranch?.name || 'ELECTRONICS ENGINEERING';

    doc.text(
      `${branchLabel.toUpperCase()} — STUDENT ACTIVITY POINTS`,
      pageW / 2,
      divY + 7,
      { align: 'center' }
    );

    const batchLabel = tutorBatch?.name
      ? `BATCH ${tutorBatch.name}`
      : 'BATCH 2021-2024';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    doc.text(
      batchLabel,
      pageW / 2,
      divY + 13,
      { align: 'center' }
    );

    doc.setLineWidth(0.4);

    doc.line(10, divY + 16, pageW - 10, divY + 16);

    // ── Table ──
    autoTable(doc, {
      startY: divY + 20,

      head: [[
        'SI:NO',
        'NAME',
        'Reg No',
        'Batch',
        'Branch',
        'Email',
        'TOTAL',
        'STATUS',
      ]],

      body: filtered.map((s, idx) => [
        idx + 1,
        s.name,
        s.registerNumber,
        s.batch?.name || '—',
        s.branch?.name || '—',
        s.email || '—',
        s.totalPoints || 0,
        (s.totalPoints || 0) >= (s.isLateralEntry ? 40 : 60)
          ? 'PASS'
          : 'FAIL',
      ]),

      styles: {
        fontSize: 8,
        cellPadding: 2,
      },

      headStyles: {
        fillColor: [30, 58, 138],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
      },

      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },
        1: { cellWidth: 38 },
        2: { cellWidth: 24 },
        3: { cellWidth: 18 },
        4: { cellWidth: 22 },
        5: { cellWidth: 40 },
        6: { halign: 'center', cellWidth: 14 },
        7: { halign: 'center', cellWidth: 14 },
      },

      didParseCell: data => {
        if (
          data.section === 'body' &&
          data.column.index === 7
        ) {
          if (data.cell.raw === 'PASS') {
            data.cell.styles.textColor = [21, 128, 61];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [185, 28, 28];
            data.cell.styles.fontStyle = 'bold';
          }
        }

        if (
          data.section === 'body' &&
          data.row.index % 2 === 0
        ) {
          data.cell.styles.fillColor = [240, 249, 255];
        }
      },
    });

    // ── Footer ──
    const finalY = doc.lastAutoTable.finalY || 200;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100);

    doc.text(
      `Generated on ${new Date().toLocaleDateString(
        'en-IN'
      )}  |  Total Students: ${filtered.length}`,
      14,
      finalY + 8
    );

    doc.save('students_activity_points.pdf');
  };

  return (
    <div className="student-list-card">
      {/* Header */}
      <div className="sl-header">
        <div className="sl-title-row">
          <Users size={22} />
          <h2>Student List</h2>

          <span className="sl-count">
            {filtered.length} students
          </span>
        </div>

        {(tutorBatch || tutorBranch) && (
          <div className="sl-scope-badge">
            {tutorBatch && (
              <span>
                Batch: <strong>{tutorBatch.name}</strong>
              </span>
            )}

            {tutorBranch && (
              <span>
                Branch: <strong>{tutorBranch.name}</strong>
              </span>
            )}
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

        <select
          className="sl-select"
          value={batchFilter}
          onChange={e => setBatchFilter(e.target.value)}
        >
          <option value="">All Batches</option>

          {batchOptions.map(b => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <select
          className="sl-select"
          value={branchFilter}
          onChange={e => setBranchFilter(e.target.value)}
        >
          <option value="">All Branches</option>

          {branchOptions.map(b => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <div className="sl-actions">
          <button
            className="sl-btn outline"
            onClick={exportExcel}
            title="Export Excel"
          >
            <Download size={15} /> Excel
          </button>

          <button
            className="sl-btn outline"
            onClick={exportPDF}
            title="Export PDF"
          >
            <Download size={15} /> PDF
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="sl-loading">
          Loading students…
        </div>
      ) : filtered.length === 0 ? (
        <div className="sl-empty">
          No students found.
        </div>
      ) : (
        <div className="sl-table-wrap">
          <table className="sl-table">
            <thead>
              <tr>
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
              {filtered.map(s => (
                <tr key={s._id}>
                  <td className="sl-name">{s.name}</td>

                  <td className="sl-mono">
                    {s.registerNumber}
                  </td>

                  <td>{s.batch?.name || '—'}</td>

                  <td>{s.branch?.name || '—'}</td>

                  <td className="sl-email">
                    {s.email}
                  </td>

                  <td>
                    <span
                      className={`sl-pts ${
                        (s.totalPoints || 0) >=
                        (s.isLateralEntry ? 40 : 60)
                          ? 'pass'
                          : (s.totalPoints || 0) >=
                            (s.isLateralEntry ? 20 : 40)
                          ? 'mid'
                          : ''
                      }`}
                      title={
                        s.isLateralEntry
                          ? 'Lateral Entry (needs 40 pts)'
                          : 'Regular (needs 60 pts)'
                      }
                    >
                      {s.totalPoints || 0}
                      {s.isLateralEntry ? ' ✦' : ''}
                    </span>
                  </td>

                  <td className="sl-action-cell">
                    <button
                      className="sl-btn primary sm"
                      onClick={() =>
                        navigate(
                          `/tutor/dashboard/students/${s._id}`
                        )
                      }
                      title="View details"
                    >
                      <Eye size={13} /> View
                    </button>

                    <button
                      className="sl-btn danger sm"
                      onClick={() =>
                        handleDelete(s._id, s.name)
                      }
                      disabled={deleting === s._id}
                      title="Delete student"
                    >
                      <Trash2 size={13} />{' '}
                      {deleting === s._id
                        ? '…'
                        : 'Delete'}
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
          <span className="sl-pts mid">✦</span> =
          Lateral Entry student (requires 40 pts
          instead of 60)
        </div>
      )}
    </div>
  );
};

export default StudentList;