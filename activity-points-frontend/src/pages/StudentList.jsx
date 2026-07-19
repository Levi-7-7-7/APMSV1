import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import tutorAxios from '../api/tutorAxios';
import {
  Download,
  Search,
  Users,
  Loader2,
  ArrowUpDown
} from 'lucide-react';

import '../css/StudentList.css';
import logo from '../assets/mti-logo.png';

import { passThreshold } from '../utils/calcPoints';
import { exportStudentsPdf } from '../utils/tutorPdfExport';
import { exportStudentsExcel } from '../utils/tutorExcelExport';

// ======================================================
// Helpers
// ======================================================

const PASS_THRESHOLD = (isLateral) => passThreshold(isLateral);

const getInitials = (name) =>
  (name || '')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

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

  const [pdfLoading, setPdfLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);

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

  const exportExcel = async () => {
    setExcelLoading(true);

    try {
      // Same department/batch sectioning as the PDF export (see
      // buildExportGroups below) — a principal's unfiltered download gets
      // every department and every batch, laid out as one styled sheet per
      // department with a summary sheet in front.
      await exportStudentsExcel({ groups: buildExportGroups() });
    } catch (err) {
      console.error('Excel export failed:', err);
      alert('Failed to generate Excel file. Please try again.');
    } finally {
      setExcelLoading(false);
    }
  };

  // ======================================================
  // PDF Export
  // ======================================================

  // Decides how the PDF should be split into department/batch sections,
  // based on the tutor's role and whatever filters are currently applied.
  // (Uses `filtered` so name/reg-no search is still respected inside each
  // section — only the batch/branch dimension is what gets auto-expanded.)
  //
  //  - principal, no filters      -> every department, every batch in it
  //  - principal, branch only     -> that department, every batch in it
  //  - principal, batch only      -> that batch, across every department
  //  - principal, branch + batch  -> exactly that one section
  //  - hod, no batch filter       -> their department, every batch in it
  //  - hod, batch filter          -> exactly that one section
  //  - tutor                      -> exactly their one scope, no filters shown
  const buildExportGroups = () => {
    const byBranchThenBatch = (list) => {
      const branches = [
        ...new Set(list.map((s) => s.branch?.name).filter(Boolean))
      ].sort();

      const groups = [];
      branches.forEach((br) => {
        const inBranch = list.filter((s) => s.branch?.name === br);
        const batches = [
          ...new Set(inBranch.map((s) => s.batch?.name).filter(Boolean))
        ].sort();

        if (batches.length === 0) {
          groups.push({ branchName: br, batchName: '', students: inBranch });
          return;
        }

        batches.forEach((b) => {
          groups.push({
            branchName: br,
            batchName: b,
            students: inBranch.filter((s) => s.batch?.name === b)
          });
        });
      });

      return groups;
    };

    if (tutorRole === 'principal') {
      if (branchFilter && batchFilter) {
        return [{ branchName: branchFilter, batchName: batchFilter, students: filtered }];
      }

      if (branchFilter && !batchFilter) {
        const batches = [
          ...new Set(filtered.map((s) => s.batch?.name).filter(Boolean))
        ].sort();

        if (batches.length === 0) {
          return [{ branchName: branchFilter, batchName: '', students: filtered }];
        }

        return batches.map((b) => ({
          branchName: branchFilter,
          batchName: b,
          students: filtered.filter((s) => s.batch?.name === b)
        }));
      }

      if (!branchFilter && batchFilter) {
        const branches = [
          ...new Set(filtered.map((s) => s.branch?.name).filter(Boolean))
        ].sort();

        if (branches.length === 0) {
          return [{ branchName: '', batchName: batchFilter, students: filtered }];
        }

        return branches.map((br) => ({
          branchName: br,
          batchName: batchFilter,
          students: filtered.filter((s) => s.branch?.name === br)
        }));
      }

      // No filters at all -> every department, every batch inside it.
      const groups = byBranchThenBatch(filtered);
      return groups.length
        ? groups
        : [{ branchName: '', batchName: '', students: filtered }];
    }

    if (tutorRole === 'hod') {
      if (batchFilter) {
        return [
          {
            branchName: tutorBranch?.name,
            batchName: batchFilter,
            students: filtered
          }
        ];
      }

      const batches = [
        ...new Set(filtered.map((s) => s.batch?.name).filter(Boolean))
      ].sort();

      if (batches.length === 0) {
        return [{ branchName: tutorBranch?.name, batchName: '', students: filtered }];
      }

      return batches.map((b) => ({
        branchName: tutorBranch?.name,
        batchName: b,
        students: filtered.filter((s) => s.batch?.name === b)
      }));
    }

    // Plain tutor: always scoped to their one batch/branch, no filters shown.
    return [
      {
        branchName: tutorBranch?.name,
        batchName: tutorBatch?.name,
        students: filtered
      }
    ];
  };

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
      // app's buildPdfHtml, rasterized via html2canvas into the PDF —
      // once per department/batch section (see buildExportGroups above).
      await exportStudentsPdf({
        groups: buildExportGroups(),
        certsByStudent,
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
            disabled={excelLoading}
          >
            {excelLoading ? (
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
                Excel
              </>
            )}
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
                <th>Photo</th>
                <th>Name</th>
                <th>Reg No</th>
                <th>Batch</th>
                <th>Branch</th>
                <th>Email</th>
                <th>Points</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((s, idx) => (
                <tr
                  key={s._id}
                  className="sl-row-clickable"
                  onClick={() =>
                    navigate(
                      `/tutor/dashboard/students/${s._id}`
                    )
                  }
                >
                  <td className="sl-rank">
                    {idx + 1}
                  </td>

                  <td>
                    <div className="sl-avatar-cell">
                      {s.profilePhoto ? (
                        <img
                          src={s.profilePhoto}
                          alt={s.name}
                          className="sl-avatar-img"
                        />
                      ) : (
                        <span className="sl-avatar-fallback">
                          {getInitials(s.name)}
                        </span>
                      )}
                    </div>
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