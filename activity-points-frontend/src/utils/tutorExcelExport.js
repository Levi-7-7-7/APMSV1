/**
 * Tutor "Student Activity Points Report" Excel export.
 *
 * Mirrors the grouping used by tutorPdfExport.js: the caller passes one or
 * more `groups` (each `{ branchName, batchName, students }`), built the same
 * way as the PDF export's groups — so a principal's "no filters" download
 * gets every department and every batch inside it, a department-only filter
 * gets every batch in that department, and so on. See buildExportGroups()
 * in StudentList.jsx for how groups are decided from role + active filters.
 *
 * Uses ExcelJS rather than the (already-installed) `xlsx` package because
 * the free build of `xlsx` cannot write cell styling (fonts, fills, borders,
 * column widths, freeze panes) — everything that makes this look like a
 * real report instead of a raw data dump.
 *
 * Layout
 * ------
 * - More than one department represented -> a styled "Summary" sheet first,
 *   with a Department/Batch/Students/Pass/Fail/Pass Rate breakdown and a
 *   grand-total row.
 * - One sheet per department. If that department has more than one batch,
 *   each batch gets its own banner row + header row + data block, stacked
 *   top to bottom on the same sheet (so a department's batches stay
 *   together and readable, instead of exploding into dozens of tabs).
 * - A single-scope export (one department, one batch — e.g. a plain tutor,
 *   or a principal with both filters applied) gets one clean sheet: title,
 *   one header row, autofilter, frozen header — no batch banners, since
 *   there's nothing to separate.
 */

// ExcelJS is loaded lazily (see exportStudentsExcel below) instead of a
// static import — it's a sizeable library only needed on the rare "export"
// click, and keeping it out of the main bundle keeps the app's initial load
// (and the PWA precache, which has a hard 2MB-per-file ceiling) lean.
import { passThreshold } from './calcPoints';

// ---------------------------------------------------------------------
// Palette — matches the PDF report's navy/gold branding.
// ---------------------------------------------------------------------
const NAVY = 'FF0F2864';
const NAVY_LIGHT = 'FF1E40AF';
const BANNER_FILL = 'FFDCE7FF';
const BANNER_TEXT = 'FF0F2864';
const WHITE = 'FFFFFFFF';
const ZEBRA_FILL = 'FFF8FAFC';
const BORDER_COLOR = 'FFCBD5E1';
const PASS_FILL = 'FFDCFCE7';
const PASS_TEXT = 'FF15803D';
const FAIL_FILL = 'FFF1F5F9';
const FAIL_TEXT = 'FF64748B';
const LATERAL_FILL = 'FFFEF3C7';
const LATERAL_TEXT = 'FF92400E';
const MUTED_TEXT = 'FF64748B';

const THIN_BORDER = { style: 'thin', color: { argb: BORDER_COLOR } };
const CELL_BORDER = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };

const DATA_COLUMNS = [
  { header: 'SL', width: 6 },
  { header: 'Name', width: 28 },
  { header: 'Register Number', width: 18 },
  { header: 'Email', width: 30 },
  { header: 'Type', width: 15 },
  { header: 'Total Points', width: 13 },
  { header: 'Status', width: 12 }
];
const COL_COUNT = DATA_COLUMNS.length;

function studentRowValues(student, sl) {
  const totalPoints = student.totalPoints || 0;
  const isPassing = totalPoints >= passThreshold(student.isLateralEntry);
  return {
    sl,
    name: student.name || '—',
    regNo: student.registerNumber || '—',
    email: student.email || '—',
    type: student.isLateralEntry ? 'Lateral Entry' : 'Regular',
    points: totalPoints,
    status: isPassing ? 'PASS' : 'PENDING',
    isPassing
  };
}

function sanitizeSheetName(name, used) {
  const base =
    (name || 'Department')
      .replace(/[\\/*?:[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 28) || 'Department';

  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` ${n}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    n += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function setColumnWidths(ws) {
  DATA_COLUMNS.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width;
  });
}

function addMergedBanner(ws, { text, fill, textColor, bold = true, size = 12, height = 20, italic = false }) {
  const row = ws.addRow([text]);
  ws.mergeCells(row.number, 1, row.number, COL_COUNT);
  const cell = row.getCell(1);
  cell.font = { name: 'Arial', bold, italic, size, color: { argb: textColor } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  if (fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  row.height = height;
  return row;
}

function addHeaderRow(ws) {
  const row = ws.addRow(DATA_COLUMNS.map((c) => c.header));
  row.eachCell((cell) => {
    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = CELL_BORDER;
  });
  row.height = 20;
  return row;
}

function addStudentRow(ws, student, sl, zebra) {
  const v = studentRowValues(student, sl);
  const row = ws.addRow([v.sl, v.name, v.regNo, v.email, v.type, v.points, v.status]);
  row.eachCell((cell, colNumber) => {
    cell.font = { name: 'Arial', size: 10, color: { argb: 'FF1E293B' } };
    cell.border = CELL_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 || colNumber === 6 ? 'center' : 'left' };
    if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_FILL } };
  });

  const typeCell = row.getCell(5);
  if (v.type === 'Lateral Entry') {
    typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LATERAL_FILL } };
    typeCell.font = { ...typeCell.font, color: { argb: LATERAL_TEXT }, bold: true, size: 9 };
    typeCell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  const statusCell = row.getCell(7);
  statusCell.font = {
    name: 'Arial',
    bold: true,
    size: 10,
    color: { argb: v.isPassing ? PASS_TEXT : FAIL_TEXT }
  };
  statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: v.isPassing ? PASS_FILL : FAIL_FILL } };
  statusCell.alignment = { horizontal: 'center', vertical: 'middle' };

  const pointsCell = row.getCell(6);
  pointsCell.font = { name: 'Arial', bold: true, size: 10, color: { argb: NAVY } };
  pointsCell.alignment = { horizontal: 'center', vertical: 'middle' };

  return row;
}

function sortedUnique(list) {
  return [...new Set(list)].sort();
}

// ---------------------------------------------------------------------
// Summary sheet — one row per department/batch group, plus a grand total.
// ---------------------------------------------------------------------
function buildSummarySheet(wb, groups, today) {
  const ws = wb.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 4 }] });
  ws.getColumn(1).width = 26;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 10;
  ws.getColumn(5).width = 10;
  ws.getColumn(6).width = 13;

  const titleRow = ws.addRow(["MTI — Student Activity Points Report"]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, 6);
  titleRow.getCell(1).font = { name: 'Arial', bold: true, size: 14, color: { argb: WHITE } };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  titleRow.height = 26;

  const subRow = ws.addRow([`Generated on ${today} | All Departments`]);
  ws.mergeCells(subRow.number, 1, subRow.number, 6);
  subRow.getCell(1).font = { name: 'Arial', italic: true, size: 10, color: { argb: MUTED_TEXT } };
  subRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  ws.addRow([]);

  const header = ws.addRow(['Department', 'Batch', 'Students', 'Pass', 'Fail', 'Pass Rate']);
  header.eachCell((cell) => {
    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = CELL_BORDER;
  });
  header.height = 20;

  let grandTotal = 0;
  let grandPass = 0;

  groups.forEach((g, i) => {
    const total = g.students.length;
    const pass = g.students.filter(
      (s) => (s.totalPoints || 0) >= passThreshold(s.isLateralEntry)
    ).length;
    const fail = total - pass;
    const rate = total > 0 ? pass / total : 0;
    grandTotal += total;
    grandPass += pass;

    const row = ws.addRow([g.branchName || '—', g.batchName || '—', total, pass, fail, rate]);
    row.getCell(6).numFmt = '0.0%';
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.border = CELL_BORDER;
      cell.alignment = { horizontal: colNumber <= 2 ? 'left' : 'center', vertical: 'middle' };
      if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_FILL } };
    });
  });

  const totalRow = ws.addRow([
    'Grand Total',
    '',
    grandTotal,
    grandPass,
    grandTotal - grandPass,
    grandTotal > 0 ? grandPass / grandTotal : 0
  ]);
  ws.mergeCells(totalRow.number, 1, totalRow.number, 2);
  totalRow.getCell(6).numFmt = '0.0%';
  totalRow.eachCell((cell, colNumber) => {
    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_LIGHT } };
    cell.alignment = { horizontal: colNumber <= 2 ? 'left' : 'center', vertical: 'middle' };
    cell.border = CELL_BORDER;
  });
  totalRow.height = 20;

  ws.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number, column: 6 } };
}

// ---------------------------------------------------------------------
// One sheet per department, batches stacked as banner + table sections.
// ---------------------------------------------------------------------
function buildDepartmentSheet(wb, branchName, batchGroups, today, usedNames, showBatchBanners) {
  const ws = wb.addWorksheet(sanitizeSheetName(branchName, usedNames));
  setColumnWidths(ws);

  addMergedBanner(ws, {
    text: 'MTI — STUDENT ACTIVITY POINTS REPORT',
    fill: NAVY,
    textColor: WHITE,
    size: 13,
    height: 24
  });
  addMergedBanner(ws, {
    text: branchName ? `DEPARTMENT OF ${branchName.toUpperCase()}` : 'DEPARTMENT',
    fill: NAVY_LIGHT,
    textColor: WHITE,
    size: 11,
    height: 20
  });
  const totalStudents = batchGroups.reduce((sum, g) => sum + g.students.length, 0);
  addMergedBanner(ws, {
    text: `Generated on ${today}  |  Total Students: ${totalStudents}`,
    textColor: MUTED_TEXT,
    bold: false,
    italic: true,
    size: 9,
    height: 16
  });
  ws.addRow([]);

  const freezeAt = ws.rowCount;
  let headerRowForFilter = null;
  let lastRowForFilter = null;

  batchGroups.forEach((g) => {
    if (showBatchBanners) {
      const pass = g.students.filter(
        (s) => (s.totalPoints || 0) >= passThreshold(s.isLateralEntry)
      ).length;
      addMergedBanner(ws, {
        text: `BATCH ${g.batchName || '—'}  —  ${g.students.length} student${
          g.students.length === 1 ? '' : 's'
        }  (${pass} pass)`,
        fill: BANNER_FILL,
        textColor: BANNER_TEXT,
        size: 10,
        height: 18
      });
    }

    const headerRow = addHeaderRow(ws);
    if (!headerRowForFilter) headerRowForFilter = headerRow.number;

    g.students.forEach((s, idx) => {
      addStudentRow(ws, s, idx + 1, idx % 2 === 1);
    });
    lastRowForFilter = ws.rowCount;

    ws.addRow([]);
  });

  ws.views = [{ state: 'frozen', ySplit: freezeAt }];
  if (!showBatchBanners && headerRowForFilter && lastRowForFilter) {
    ws.autoFilter = {
      from: { row: headerRowForFilter, column: 1 },
      to: { row: lastRowForFilter, column: COL_COUNT }
    };
  }
}

// ---------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------
export async function exportStudentsExcel({ groups }) {
  if (!groups || groups.length === 0) {
    throw new Error('exportStudentsExcel: at least one group is required');
  }

  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MTI Activity Points System';
  wb.created = new Date();

  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  const branchNames = sortedUnique(groups.map((g) => g.branchName).filter(Boolean));
  const isMultiGroup = groups.length > 1;

  if (isMultiGroup) {
    buildSummarySheet(wb, groups, today);
  }

  const usedNames = new Set(['summary']);

  if (branchNames.length === 0) {
    // No branch info at all — one flat sheet.
    buildDepartmentSheet(wb, '', groups, today, usedNames, groups.length > 1);
  } else {
    branchNames.forEach((branchName) => {
      const batchGroups = groups.filter((g) => (g.branchName || '') === branchName);
      buildDepartmentSheet(wb, branchName, batchGroups, today, usedNames, batchGroups.length > 1);
    });
    // Any groups with no branch name (shouldn't normally happen) get their own sheet too.
    const noBranch = groups.filter((g) => !g.branchName);
    if (noBranch.length > 0) {
      buildDepartmentSheet(wb, 'Unassigned', noBranch, today, usedNames, noBranch.length > 1);
    }
  }

  // --- Filename, same convention as the PDF export. ---
  const slug = (s) => (s || '').replace(/\s+/g, '_').toLowerCase();
  const fileDate = new Date().toLocaleDateString('en-IN').replace(/\//g, '-');
  const batchNames = sortedUnique(groups.map((g) => g.batchName).filter(Boolean));
  let baseName;
  if (isMultiGroup) {
    if (branchNames.length > 1 && batchNames.length > 1) {
      baseName = 'all_departments_all_batches';
    } else if (branchNames.length === 1) {
      baseName = `${slug(branchNames[0])}_all_batches`;
    } else if (batchNames.length === 1) {
      baseName = `all_departments_${slug(batchNames[0])}`;
    } else {
      baseName = 'activity_points_report';
    }
  } else {
    baseName = `${slug(groups[0].branchName) || 'dept'}_${slug(groups[0].batchName) || 'batch'}`;
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}_${fileDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
