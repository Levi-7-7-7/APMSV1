/**
 * utils/deleteStudentCascade.js
 *
 * Deletes a student and everything that belongs to them:
 *   - every certificate file the student uploaded, from ImageKit
 *   - the student's whole certificate folder on ImageKit
 *     (/certificates/{department}/{batch}/{studentName}), so nothing is
 *     left behind even if a stray/legacy file wasn't tracked in Mongo
 *   - the student's profile photo, from ImageKit (if any)
 *   - all their Certificate documents
 *   - the Student document itself
 *
 * Used by both the tutor "delete student" route and the admin "delete
 * student" route so the cleanup logic only lives in one place.
 *
 * ImageKit deletions are best-effort: if a remote file/folder is already
 * gone, or ImageKit is briefly unreachable, we log it and continue — a
 * failed remote delete should never block removing the student's data
 * from our own database.
 */

const Certificate = require('../models/Certificate');
const Student = require('../models/Student');
const imagekit = require('./imagekit');
const { buildStudentCertFolder } = require('./imagekitPaths');

async function deleteStudentCascade(studentId) {
  const student = await Student.findById(studentId).populate('branch').populate('batch');
  if (!student) return null;

  const certificates = await Certificate.find({ student: studentId }).select('fileId');

  // Delete every certificate file on ImageKit
  await Promise.all(
    certificates.map(async (cert) => {
      if (!cert.fileId) return;
      try {
        await imagekit.deleteFile(cert.fileId);
      } catch (err) {
        console.error(
          `Failed to delete ImageKit file ${cert.fileId} (certificate ${cert._id}):`,
          err.message,
        );
      }
    }),
  );

  // Delete the student's own certificate folder on ImageKit (e.g.
  // /certificates/Computer_Science/2023-2027/Arjun_Menon), catching anything
  // the per-file deletes above didn't know about.
  const folderPath = buildStudentCertFolder(student.branch?.name, student.batch?.name, student.name);
  if (folderPath) {
    try {
      await imagekit.deleteFolder(folderPath);
    } catch (err) {
      // Not fatal — folder may not exist (e.g. student never uploaded anything)
      console.error(`Failed to delete ImageKit folder ${folderPath}:`, err.message);
    }
  }

  // Delete the profile photo on ImageKit, if one was uploaded
  if (student.profilePhotoFileId) {
    try {
      await imagekit.deleteFile(student.profilePhotoFileId);
    } catch (err) {
      console.error(
        `Failed to delete ImageKit profile photo ${student.profilePhotoFileId} (student ${studentId}):`,
        err.message,
      );
    }
  }

  await Certificate.deleteMany({ student: studentId });
  await Student.findByIdAndDelete(studentId);

  return student;
}

module.exports = deleteStudentCascade;
