/**
 * utils/deleteBatchCascade.js
 *
 * "Batch delete" for students who have already passed out (or any batch
 * an admin wants to clear out entirely): removes every student belonging
 * to a batch — optionally scoped to a single branch — along with:
 *   - each student's Certificate documents
 *   - each student's profile photo on ImageKit (stored flat, so each one
 *     has to be removed individually by fileId)
 *   - the Student documents themselves
 *   - the ImageKit certificate folder(s) for that batch, e.g.
 *       /certificates/Computer_Science/2022-2026
 *     removed wholesale (one call per branch involved) instead of one
 *     student-folder at a time — this is what actually clears the batch
 *     off the file server.
 *
 * Everything ImageKit-related is best-effort: a missing/already-deleted
 * remote file or folder is logged and skipped rather than aborting the
 * whole operation.
 */

const Student = require('../models/Student');
const Certificate = require('../models/Certificate');
const Batch = require('../models/Batch');
const Branch = require('../models/Branch');
const imagekit = require('./imagekit');
const { buildBatchCertFolder } = require('./imagekitPaths');

async function deleteBatchCascade(batchId, branchId) {
  const batch = await Batch.findById(batchId);
  if (!batch) return null;

  let branch = null;
  if (branchId) {
    branch = await Branch.findById(branchId);
    if (!branch) throw new Error('Branch not found');
  }

  const filter = { batch: batchId };
  if (branchId) filter.branch = branchId;

  const students = await Student.find(filter).populate('branch', 'name');
  if (students.length === 0) {
    return { batch, branch, deletedCount: 0, deletedNames: [], branchesCleaned: [] };
  }

  const studentIds = students.map(s => s._id);

  // Delete each student's profile photo on ImageKit (flat /student-profiles
  // folder — no per-batch grouping to delete wholesale, so this stays per-file)
  await Promise.all(
    students.map(async (student) => {
      if (!student.profilePhotoFileId) return;
      try {
        await imagekit.deleteFile(student.profilePhotoFileId);
      } catch (err) {
        console.error(
          `Failed to delete ImageKit profile photo ${student.profilePhotoFileId} (student ${student._id}):`,
          err.message,
        );
      }
    }),
  );

  // Database cleanup
  await Certificate.deleteMany({ student: { $in: studentIds } });
  await Student.deleteMany({ _id: { $in: studentIds } });

  // Clear the batch's certificate folder(s) on ImageKit — one per distinct
  // branch actually present among the deleted students (or just the one
  // branch requested, if the delete was scoped to a single branch).
  const branchNames = branchId
    ? [branch.name]
    : [...new Set(students.map(s => s.branch?.name).filter(Boolean))];

  const branchesCleaned = [];
  await Promise.all(
    branchNames.map(async (branchName) => {
      const folderPath = buildBatchCertFolder(branchName, batch.name);
      if (!folderPath) return;
      try {
        await imagekit.deleteFolder(folderPath);
        branchesCleaned.push(branchName);
      } catch (err) {
        // Not fatal — folder may not exist (e.g. no certificates were ever uploaded)
        console.error(`Failed to delete ImageKit folder ${folderPath}:`, err.message);
      }
    }),
  );

  return {
    batch,
    branch,
    deletedCount: students.length,
    deletedNames: students.map(s => s.name),
    branchesCleaned,
  };
}

module.exports = deleteBatchCascade;
