/**
 * utils/syncStudentCertFolder.js
 *
 * Keeps a student's ImageKit certificate folder in sync when an admin
 * changes their batch, branch, or name. The folder path
 * (/certificates/{branch}/{batch}/{studentName}) is built from exactly
 * those three things, so changing any of them would otherwise leave the
 * old folder behind (with old certs + profile photo inside it) and start
 * a brand new, empty-looking folder for anything uploaded afterwards.
 *
 * Two cases:
 *   - Only batch/branch changed (name unchanged): ImageKit's moveFolder
 *     can relocate the whole folder as-is into the new parent in one call.
 *   - Name changed (with or without a batch/branch change): ImageKit has
 *     no folder-rename API, so instead every known file (certificates +
 *     profile photo) is moved into the new folder path individually, and
 *     the emptied old folder is then removed.
 *
 * Either way, every affected Certificate.fileUrl / Student.profilePhoto in
 * the database is refreshed afterwards so links keep working — ImageKit
 * URLs encode the folder path, so a moved file gets a new URL even though
 * its fileId never changes.
 *
 * Best-effort throughout: a sync failure is logged and reported back in
 * the return value, but must never throw past this module or block the
 * admin's edit from saving.
 */

const Certificate = require('../models/Certificate');
const Student = require('../models/Student');
const imagekit = require('./imagekit');
const { buildStudentCertFolder, sanitizeName } = require('./imagekitPaths');

const JOB_POLL_INTERVAL_MS = 1000;
const JOB_POLL_MAX_TRIES = 10; // ~10s ceiling — these are single-student folders, so moves are small

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForBulkJob(jobId) {
  for (let i = 0; i < JOB_POLL_MAX_TRIES; i++) {
    await sleep(JOB_POLL_INTERVAL_MS);
    try {
      const status = await imagekit.getBulkJobStatus(jobId);
      if (status?.status === 'Completed') return true;
    } catch (err) {
      console.error(`Failed to poll ImageKit job ${jobId}:`, err.message);
      return false;
    }
  }
  return false; // gave up waiting — the move may still finish on ImageKit's side later
}

// Re-fetch each known file's current URL from ImageKit and save it back onto
// the matching Certificate/Student record, so stored links don't 404 after a move.
async function refreshStoredUrls(studentId) {
  const [certificates, student] = await Promise.all([
    Certificate.find({ student: studentId }).select('fileId fileUrl'),
    Student.findById(studentId).select('profilePhoto profilePhotoFileId'),
  ]);

  await Promise.all(certificates.map(async (cert) => {
    if (!cert.fileId) return;
    try {
      const details = await imagekit.getFileDetails(cert.fileId);
      if (details?.url && details.url !== cert.fileUrl) {
        cert.fileUrl = details.url;
        await cert.save();
      }
    } catch (err) {
      console.error(`Failed to refresh URL for certificate ${cert._id}:`, err.message);
    }
  }));

  if (student?.profilePhotoFileId) {
    try {
      const details = await imagekit.getFileDetails(student.profilePhotoFileId);
      if (details?.url && details.url !== student.profilePhoto) {
        student.profilePhoto = details.url;
        await student.save();
      }
    } catch (err) {
      console.error(`Failed to refresh profile photo URL for student ${studentId}:`, err.message);
    }
  }
}

/**
 * @param studentId
 * @param before { name, branchName, batchName } — values before the edit
 * @param after  { name, branchName, batchName } — values after the edit
 * @returns { moved: boolean, warning?: string }
 */
async function syncStudentCertFolder(studentId, before, after) {
  const oldFolder = buildStudentCertFolder(before.branchName, before.batchName, before.name);
  const newFolder = buildStudentCertFolder(after.branchName, after.batchName, after.name);

  if (!oldFolder || !newFolder || oldFolder === newFolder) {
    return { moved: false };
  }

  const nameUnchanged = sanitizeName(before.name) === sanitizeName(after.name);

  try {
    if (nameUnchanged) {
      // Only batch/branch changed — relocate the whole folder in one call.
      const newParent = newFolder.slice(0, newFolder.lastIndexOf('/'));
      const moveResult = await imagekit.moveFolder({ sourceFolderPath: oldFolder, destinationPath: newParent });
      const completed = moveResult?.jobId ? await waitForBulkJob(moveResult.jobId) : true;
      if (!completed) {
        return { moved: false, warning: "Folder move is still processing on ImageKit — links will update shortly." };
      }
    } else {
      // Name changed — no folder-rename API, so move every known file individually.
      const certificates = await Certificate.find({ student: studentId }).select('fileId');
      const student = await Student.findById(studentId).select('profilePhotoFileId');
      const fileIds = certificates.map(c => c.fileId).filter(Boolean);
      if (student?.profilePhotoFileId) fileIds.push(student.profilePhotoFileId);

      await Promise.all(fileIds.map(async (fileId) => {
        try {
          const details = await imagekit.getFileDetails(fileId);
          if (details?.filePath) {
            await imagekit.moveFile({ sourceFilePath: details.filePath, destinationPath: newFolder });
          }
        } catch (err) {
          console.error(`Failed to move ImageKit file ${fileId} into ${newFolder}:`, err.message);
        }
      }));

      // Clean up the now-empty old folder
      try {
        await imagekit.deleteFolder(oldFolder);
      } catch (err) {
        console.error(`Failed to remove emptied folder ${oldFolder}:`, err.message);
      }
    }

    await refreshStoredUrls(studentId);
    return { moved: true };
  } catch (err) {
    // Likely cause: the student never uploaded anything, so oldFolder never
    // existed on ImageKit in the first place — nothing to move, not fatal.
    console.error(`Failed to sync ImageKit folder for student ${studentId} (${oldFolder} -> ${newFolder}):`, err.message);
    return { moved: false, warning: "Could not move certificate/profile files to match the update — old files remain in their previous folder." };
  }
}

module.exports = syncStudentCertFolder;
