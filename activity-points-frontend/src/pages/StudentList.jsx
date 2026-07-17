import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import tutorAxios from '../api/tutorAxios';
import {
  Download,
  Search,
  Trash2,
  Eye,
  Users,
  Loader2,
  ArrowUpDown
} from 'lucide-react';

import * as XLSX from 'xlsx';

import '../css/StudentList.css';
import logo from '../assets/mti-logo.png';

import { passThreshold } from '../utils/calcPoints';
import { exportStudentsPdf } from '../utils/tutorPdfExport';

// ======================================================
// Helpers
// ======================================================

const PASS_THRESHOLD = (isLateral) => passThreshold(isLateral);

// ======================================================
// Component
// ======================================================

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

  const [pdfLoading, setPdfLoading] = useState(false);

  const [sortBy, setSortBy] = useState('regNo');

  const tutorBatch = JSON.parse(
    localStorage.getItem('tutorBatch') || 'null'
  );

  const tutorBranch = JSON.parse(
    localStorage.getItem('tutorBranch') || 'null'
  );

  // 'tutor' = scoped to one batch + branch, no filters needed
  // 'hod'   = scoped to one branch, sees every batch in it -> batch filter only
  // 'principal' = sees everything -> both filters
  const tutorRole = localStorage.getItem('tutorRole') || 'tutor';
  const showBatchFilter = tutorRole === 'hod' || tutorRole === 'principal';
  const showBranchFilter = tutorRole === 'principal';

  // ======================================================
  // Fetch Students
  // ======================================================

  const fetchStudents = async () => {
    setLoading(true);

    try {
      const res = await tutorAxios.get('/tutors/students');

      const list = res.data.students || [];

      setStudents(list);

      setBatchOptions([
        ...new Set(
          list.map((s) => s.batch?.name).filter(Boolean)
        )
      ]);

      setBranchOptions([
        ...new Set(
          list.map((s) => s.branch?.name).filter(Boolean)
        )
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

  // ======================================================
  // Delete Student
  // ======================================================

  const handleDelete = async (id, name) => {
    const ok = window.confirm(
      `Delete student "${name}"? This will also remove all their certificates.`
    );

    if (!ok) return;

    setDeleting(id);

    try {
      await tutorAxios.delete(`/tutors/students/${id}`);

      setStudents((prev) =>
        prev.filter((s) => s._id !== id)
      );

      setMsg(`Student "${name}" deleted.`);

      setTimeout(() => {
        setMsg('');
      }, 3500);
    } catch (err) {
      alert(
        err.response?.data?.error ||
          'Failed to delete student'
      );
    } finally {
      setDeleting(null);
    }
  };

  // ======================================================
  // Filter + Sort
  // ======================================================

  const filtered = students
    .filter((s) => {
      const nameOk = search
        ? s.name
            ?.toLowerCase()
            .includes(search.toLowerCase())
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

      return (
        nameOk &&
        regOk &&
        batchOk &&
        branchOk
      );
    })
    .slice()
    .sort((a, b) => {
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(
          b.name || ''
        );
      }

      if (sortBy === 'points') {
        return (
          (b.totalPoints || 0) -
          (a.totalPoints || 0)
        );
      }

      return (a.registerNumber || '').localeCompare(
        b.registerNumber || '',
        undefined,
        { numeric: true }
      );
    });

  // ======================================================
  // Excel Export
  // ======================================================

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      filtered.map((s) => ({
        Name: s.name,
        RegisterNumber: s.registerNumber,
        Batch: s.batch?.name,
        Branch: s.branch?.name,
        Email: s.email,
        TotalPoints: s.totalPoints || 0,
        Type: s.isLateralEntry
          ? 'Lateral Entry'
          : 'Regular',
        Status:
          (s.totalPoints || 0) >=
          PASS_THRESHOLD(s.isLateralEntry)
            ? 'PASS'
            : 'FAIL'
      }))
    );

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      ws,
      'Students'
    );

    XLSX.writeFile(wb, 'students_list.xlsx');
  };

  // ======================================================
  // PDF Export
  // ======================================================

  const exportPDF = async () => {
    setPdfLoading(true);

    try {
      const certRes = await tutorAxios.get(
        '/tutors/certificates'
      );

      const allCerts =
        certRes.data.certificates || [];

      const certsByStudent = {};

      allCerts.forEach((cert) => {
        const sid =
          cert.student?._id || cert.student;

        if (!certsByStudent[sid]) {
          certsByStudent[sid] = [];
        }

        certsByStudent[sid].push(cert);
      });

      // Renders the exact same header / gradient title band / rowspan
      // ledger table / trophy badges / footer as the React Native tutor
      // app's buildPdfHtml, rasterized via html2canvas into the PDF.
      await exportStudentsPdf({
        students: filtered,
        certsByStudent,
        tutorBranch: tutorBranch?.name,
        tutorBatch: tutorBatch?.name,
        logoUrl: logo
      });
    } catch (err) {
      console.error(
        'PDF export failed:',
        err
      );

      alert(
        'Failed to generate PDF. Please try again.'
      );
    } finally {
      setPdfLoading(false);
    }
  };

  // ======================================================
  // JSX
  // ======================================================

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

        {(tutorBatch ||
          tutorBranch) && (
          <div className="sl-scope-badge">
            {tutorBatch && (
              <span>
                Batch:{' '}
                <strong>
                  {tutorBatch.name}
                </strong>
              </span>
            )}

            {tutorBranch && (
              <span>
                Branch:{' '}
                <strong>
                  {tutorBranch.name}
                </strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Message */}
      {msg && (
        <div className="sl-msg">
          {msg}
        </div>
      )}

      {/* Filters */}
      <div className="sl-filters">
        <div className="sl-search-group">
          <Search
            size={15}
            className="sl-search-icon"
          />

          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            className="sl-input"
          />
        </div>

        <div className="sl-search-group">
          <Search
            size={15}
            className="sl-search-icon"
          />

          <input
            type="text"
            placeholder="Search by reg no..."
            value={regSearch}
            onChange={(e) =>
              setRegSearch(
                e.target.value
              )
            }
            className="sl-input"
          />
        </div>

        {showBatchFilter && (
          <select
            className="sl-select"
            value={batchFilter}
            onChange={(e) =>
              setBatchFilter(
                e.target.value
              )
            }
          >
            <option value="">
              All Batches
            </option>

            {batchOptions.map((b) => (
              <option
                key={b}
                value={b}
              >
                {b}
              </option>
            ))}
          </select>
        )}

        {showBranchFilter && (
          <select
            className="sl-select"
            value={branchFilter}
            onChange={(e) =>
              setBranchFilter(
                e.target.value
              )
            }
          >
            <option value="">
              All Branches
            </option>

            {branchOptions.map((b) => (
              <option
                key={b}
                value={b}
              >
                {b}
              </option>
            ))}
          </select>
        )}

        <div className="sl-sort-group">
          <ArrowUpDown
            size={14}
            className="sl-sort-icon"
          />

          <select
            className="sl-select sl-sort-select"
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value
              )
            }
          >
            <option value="regNo">
              Sort: Reg No
            </option>

            <option value="name">
              Sort: Name
            </option>

            <option value="points">
              Sort: Highest Points
            </option>
          </select>
        </div>

        {/* Actions */}
        <div className="sl-actions">
          <button
            className="sl-btn outline"
            onClick={exportExcel}
          >
            <Download size={15} />
            Excel
          </button>

          <button
            className="sl-btn outline"
            onClick={exportPDF}
            disabled={pdfLoading}
          >
            {pdfLoading ? (
              <>
                <Loader2
                  size={15}
                  className="sl-spin"
                />
                Generating...
              </>
            ) : (
              <>
                <Download size={15} />
                PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="sl-loading">
          Loading students...
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
                  <td className="sl-rank">
                    {idx + 1}
                  </td>

                  <td className="sl-name">
                    {s.name}
                  </td>

                  <td className="sl-mono">
                    {s.registerNumber}
                  </td>

                  <td>
                    {s.batch?.name || '—'}
                  </td>

                  <td>
                    {s.branch?.name || '—'}
                  </td>

                  <td className="sl-email">
                    {s.email}
                  </td>

                  <td>
                    <span
                      className={`sl-pts ${
                        (s.totalPoints ||
                          0) >=
                        PASS_THRESHOLD(
                          s.isLateralEntry
                        )
                          ? 'pass'
                          : (s.totalPoints ||
                              0) >=
                            PASS_THRESHOLD(
                              s.isLateralEntry
                            ) /
                              2
                          ? 'mid'
                          : ''
                      }`}
                    >
                      {s.totalPoints || 0}

                      {s.isLateralEntry
                        ? ' ✦'
                        : ''}
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
                    >
                      <Eye size={13} />
                      View
                    </button>

                    <button
                      className="sl-btn danger sm"
                      onClick={() =>
                        handleDelete(
                          s._id,
                          s.name
                        )
                      }
                      disabled={
                        deleting === s._id
                      }
                    >
                      <Trash2 size={13} />

                      {deleting === s._id
                        ? '...'
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
      {students.some(
        (s) => s.isLateralEntry
      ) && (
        <div className="sl-legend">
          <span className="sl-pts mid">
            ✦
          </span>{' '}
          = Lateral Entry student
        </div>
      )}
    </div>
  );
};

export default StudentList;