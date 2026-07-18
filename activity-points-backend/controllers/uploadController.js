const multer      = require('multer');
const imagekit    = require('../utils/imagekit');
const Certificate = require('../models/Certificate');
const Category    = require('../models/Category');
const Student     = require('../models/Student');
const Tutor       = require('../models/Tutor');
const { sendPushNotification } = require('../utils/fcm');
const { sanitizeName, buildStudentCertFolder } = require('../utils/imagekitPaths');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

exports.uploadCertificate = [
  upload.single('file'),
  async (req, res) => {
    try {
      const studentId = req.user.id;
      const { categoryId, subcategoryName, level, prizeType, eventName, dateFrom, dateTo } = req.body;

      if (!req.file || !categoryId || !subcategoryName) {
        return res.status(400).json({ message: "Missing required fields (file, categoryId, subcategoryName)" });
      }

      // Handle "Others" — student described a certificate not in the category list
      const isOthers = categoryId === 'others';
      let potentialPoints = 0;

      if (!isOthers) {
        const category = await Category.findById(categoryId);
        if (!category) return res.status(404).json({ message: "Category not found" });

        // Validate subcategory exists by name
        const sub = category.subcategories.find(
          s => s.name.toLowerCase() === subcategoryName.toLowerCase()
        );
        if (!sub) return res.status(404).json({ message: "Subcategory not found in category" });

        // Calculate potentialPoints at upload time so student sees an estimate
        if (sub.fixedPoints != null) {
          potentialPoints = sub.fixedPoints;
        } else if (sub.levels?.length && level && prizeType) {
          const lvl  = sub.levels.find(l => l.name.toLowerCase() === level.toLowerCase());
          const prize = lvl?.prizes.find(p => p.type === prizeType);
          potentialPoints = prize?.points ?? 0;
        }
      }

      // Fetch student with branch (department) and batch populated for folder naming
      const student = await Student.findById(studentId).populate('branch').populate('batch');
      if (!student) return res.status(404).json({ message: "Student not found" });

      // Build structured ImageKit folder: /certificates/{department}/{batch}/{studentName}
      const folderPath  = buildStudentCertFolder(student.branch?.name, student.batch?.name, student.name);

      // Use the event name entered by the student as the certificate file name,
      // preserving the original file extension (e.g. eventName="Hackathon" → "Hackathon.pdf")
      const ext = req.file.originalname.split(".").pop();
      const baseName = sanitizeName(eventName?.trim() || req.file.originalname);
      const certFileName = baseName + "." + ext;

      // Upload file to ImageKit under the structured folder
      const base64File = req.file.buffer.toString('base64');
      const uploadResult = await imagekit.upload({
        file:     base64File,
        fileName: certFileName,
        folder:   folderPath,
      });

      const cert = await Certificate.create({
        student:         studentId,
        category:        isOthers ? null : categoryId,  // FIX: null for others, no invalid ObjectId
        subcategory:     subcategoryName,
        level:           level   || null,
        prizeType:       prizeType || null,
        eventName:       eventName?.trim() || '',
        dateFrom:        dateFrom || null,
        dateTo:          dateTo   || null,
        fileUrl:         uploadResult.url,
        fileId:          uploadResult.fileId,
        potentialPoints,
        status:          'pending',
        pointsAwarded:   0,
        isOthers:        isOthers,  // flag so admin/tutor knows to handle manually
      });

      // ── Notify the tutor assigned to this student's batch/branch ─────────────
      try {
        const tutor = await Tutor.findOne({
          batch:  student.batch?._id  || student.batch,
          branch: student.branch?._id || student.branch,
          fcmToken: { $ne: null },
        }).select('fcmToken');

        if (tutor?.fcmToken) {
          const certLabel = eventName?.trim() || subcategoryName || 'a certificate';
          await sendPushNotification(
            tutor.fcmToken,
            '📄 New Certificate Uploaded',
            `${student.name} submitted ${certLabel} — tap to review.`,
            { type: 'new_certificate', certId: String(cert._id), status: 'pending' },
          );
        }
      } catch (notifyErr) {
        // Never fail the upload because of a notification error
        console.warn('[FCM] Tutor notification failed:', notifyErr.message);
      }
      // ─────────────────────────────────────────────────────────────────────────

      res.json({ message: "Certificate uploaded successfully", certificate: cert });
    } catch (error) {
      console.error("Upload Error:", error);
      res.status(500).json({ message: "Upload failed", error: error.message });
    }
  }
];

/**
 * GET /api/certificates/my
 *
 * Returns the student's own certificates.
 *
 * Optional query param:
 *   ?since=<ISO-8601 timestamp>
 *     When provided, returns ONLY certificates whose status was updated
 *     (updatedAt) after that timestamp AND whose status is either
 *     'approved' or 'rejected'.
 *
 *     This is used by the native app's notification polling so it only
 *     fetches changed records instead of the full list every 30 s.
 *
 *   ?notifyOnly=true
 *     Must be combined with `since`. Returns a minimal payload:
 *     { notifications: [{ _id, eventName, subcategory, status, rejectionReason }] }
 *     — no category population needed, keeps the response tiny.
 *
 * Without `since`, behaviour is unchanged (returns all certs, populated).
 */
exports.getMyCertificates = async (req, res) => {
  try {
    const { since, notifyOnly } = req.query;

    // ── Notification-only fast path ──────────────────────────────────────────
    if (since && notifyOnly === 'true') {
      const sinceDate = new Date(since);
      if (isNaN(sinceDate.getTime())) {
        return res.status(400).json({ error: 'Invalid `since` date' });
      }

      const changed = await Certificate.find({
        student:   req.user.id,
        status:    { $in: ['approved', 'rejected'] },
        updatedAt: { $gt: sinceDate },
      })
        .select('_id eventName subcategory status rejectionReason updatedAt')
        .lean();

      return res.json({ notifications: changed });
    }

    // ── Normal full fetch (unchanged behaviour) ───────────────────────────────
    const certs = await Certificate.find({ student: req.user.id })
      .populate('category', 'name maxPoints')
      .sort({ createdAt: -1 });

    res.json({ certificates: certs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
