/**
 * utils/imagekitPaths.js
 *
 * Single source of truth for the ImageKit folder scheme used for student
 * certificates, so upload, single-delete, and batch-delete never drift
 * apart:
 *
 *   /certificates/{department}/{batch}/{studentName}
 *
 * Mirrors the sanitize/folder logic in controllers/uploadController.js.
 */

// Sanitize a string so it's safe to use as an ImageKit folder/file name
function sanitizeName(str) {
  return (str || 'unknown')
    .trim()
    .replace(/[\/\\:*?"<>|#]/g, '_')  // remove path-unsafe characters
    .replace(/\s+/g, '_');             // spaces → underscores
}

// Folder for a single student's certificates: /certificates/{dept}/{batch}/{studentName}
function buildStudentCertFolder(branchName, batchName, studentName) {
  if (!branchName && !batchName && !studentName) return null;
  const department  = sanitizeName(branchName);
  const batch        = sanitizeName(batchName);
  const studentPart  = sanitizeName(studentName);
  return `/certificates/${department}/${batch}/${studentPart}`;
}

// Folder for an entire batch within a branch: /certificates/{dept}/{batch}
function buildBatchCertFolder(branchName, batchName) {
  if (!branchName || !batchName) return null;
  const department = sanitizeName(branchName);
  const batch      = sanitizeName(batchName);
  return `/certificates/${department}/${batch}`;
}

// Folder for ticket/complaint attachment images: /tickets/{raiserName}
function buildTicketFolder(raiserName) {
  return `/tickets/${sanitizeName(raiserName)}`;
}

module.exports = { sanitizeName, buildStudentCertFolder, buildBatchCertFolder, buildTicketFolder };
