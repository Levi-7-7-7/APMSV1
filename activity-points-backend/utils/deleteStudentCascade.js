/**
 * utils/deleteStudentCascade.js
 *
 * Deletes a student and everything that belongs to them:
 *   - every certificate file the student uploaded, from ImageKit
 *   - the student's profile photo, from ImageKit (if any)
 *   - all their Certificate documents
 *   - the Student document itself
 *
 * Used by both the tutor "delete student" route and the admin "delete
 * student" route so the cleanup logic only lives in one place.
 *
 * ImageKit deletions are best-effort: if a remote file is already gone,
 * or ImageKit is briefly unreachable, we log it and continue — a failed
 * remote delete should never block removing the student's data from our
 * own database.
 */

const Certificate = require('../models/Certificate');
const Student = require('../models/Student');
const imagekit = require('./imagekit');

async function deleteStudentCascade(studentId) {
  const student = await Student.findById(studentId);
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
